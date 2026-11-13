import { matchMaker } from "@colyseus/core";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import type { ErrorMessage, MatchSnapshot } from "@pokemon-chess/protocol";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import appConfig from "../src/app.config.js";
import type { MatchRoom } from "../src/MatchRoom.js";
import { inbox } from "./inbox.js";

/**
 * End-to-end over a real WebSocket: two SDK clients join one MatchRoom. Battle outcomes here use
 * the room's own seeded RNG, so these tests check wiring and agreement between the two clients;
 * exact outcomes are covered by match.test.ts with scripted rolls.
 */

let colyseus: ColyseusTestServer;
beforeAll(async () => {
  colyseus = await boot(appConfig);
});
afterAll(async () => {
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
});

async function twoPlayers(createOptions: Record<string, unknown> = {}) {
  const room = (await colyseus.createRoom("match", createOptions)) as MatchRoom;
  const a = await colyseus.connectTo(room, { nickname: "Ash" });
  const aIn = inbox(a);
  const b = await colyseus.connectTo(room, { nickname: "Gary" });
  const bIn = inbox(b);
  const [aSnap, bSnap] = await Promise.all([aIn.next("snapshot"), bIn.next("snapshot")]);
  const white = aSnap.you === "white" ? { c: a, in: aIn } : { c: b, in: bIn };
  const black = aSnap.you === "white" ? { c: b, in: bIn } : { c: a, in: aIn };
  return { room, a, b, aSnap, bSnap, white, black };
}

/** Any legal first move for White: a pawn one step forward is always legal at the start. */
const firstMove = (snap: MatchSnapshot) => {
  const from = snap.state.board.findIndex((p) => p?.color === "white" && p.role === "pawn");
  return { from, to: from + 8 };
};

describe("MatchRoom", () => {
  it("seats two players with opposite colours and identical boards", async () => {
    const { aSnap, bSnap, room } = await twoPlayers();
    expect([aSnap.you, bSnap.you].sort()).toEqual(["black", "white"]);
    expect(aSnap.state).toEqual(bSnap.state);
    expect(aSnap.matchId).toBe(room.roomId);
    expect(aSnap.players.map((p) => p.nickname).sort()).toEqual(["Ash", "Gary"]);
  });

  it("applies White's move and sends both clients the same events", async () => {
    const { aSnap, white, black, room } = await twoPlayers();
    white.c.send("move", firstMove(aSnap));
    const [w, b] = await Promise.all([white.in.next("events"), black.in.next("events")]);
    expect(w.seq).toBe(1);
    expect(w.events).toEqual(b.events);
    expect(w.snapshot.state).toEqual(b.snapshot.state);
    expect(w.snapshot.state.turn).toBe("black");
    expect(room.match.log).toHaveLength(1);
  });

  it("answers an out-of-turn move with an error, only to the sender", async () => {
    const { aSnap, black, white, room } = await twoPlayers();
    black.c.send("move", firstMove(aSnap));
    const err: ErrorMessage = await black.in.next("error");
    expect(err.code).toBe("notYourTurn");
    await expect(white.in.next("error", 300)).rejects.toThrow();
    expect(room.match.log).toHaveLength(0);
  });

  it("rejects malformed and unknown messages before they reach the match", async () => {
    const { white, room } = await twoPlayers();
    white.c.send("move", { from: "e2", to: "e4" });
    expect((await white.in.next("error")).code).toBe("invalidMessage");
    white.c.send("teleport", {});
    expect((await white.in.next("error")).code).toBe("invalidMessage");
    expect(room.match.log).toHaveLength(0);
  });

  it("ends the match on resignation and tells both players", async () => {
    const { white, black } = await twoPlayers();
    black.c.send("resign");
    const [w, b] = await Promise.all([white.in.next("events"), black.in.next("events")]);
    expect(w.snapshot.state.status).toEqual({
      state: "won",
      winner: "white",
      reason: "resignation",
    });
    expect(b.snapshot.state.status).toEqual(w.snapshot.state.status);
  });

  it("refuses a join without a valid nickname", async () => {
    const room = (await colyseus.createRoom("match", {})) as MatchRoom;
    await expect(colyseus.connectTo(room, { nickname: "   " })).rejects.toThrow();
    await expect(colyseus.connectTo(room, {})).rejects.toThrow();
  });

  it("does not let a third client into a full match", async () => {
    const { room } = await twoPlayers();
    await expect(colyseus.connectTo(room, { nickname: "Brock" })).rejects.toThrow();
  });

  it("tells the remaining player when the opponent leaves", async () => {
    const { a, b, aSnap } = await twoPlayers();
    const bIn = inbox(b);
    await a.leave();
    const snap: MatchSnapshot = await bIn.next("snapshot");
    expect(snap.players.find((p) => p.color === aSnap.you)?.connected).toBe(false);
  });
});

describe("MatchRoom clocks (R11)", () => {
  it("defaults to the 10+5 matchmaking control with White's clock running", async () => {
    const { aSnap } = await twoPlayers();
    expect(aSnap.timeControl).toBe("10+5");
    expect(aSnap.clocks?.running).toBe("white");
    expect(aSnap.clocks?.white).toBeLessThanOrEqual(600_000);
    expect(aSnap.clocks?.white).toBeGreaterThan(590_000);
    expect(aSnap.clocks?.black).toBe(600_000);
  });

  it("honours an untimed room", async () => {
    const { aSnap } = await twoPlayers({ timeControl: "untimed" });
    expect(aSnap.timeControl).toBe("untimed");
    expect(aSnap.clocks).toBeNull();
  });

  it("refuses an unknown time control", async () => {
    await expect(colyseus.createRoom("match", { timeControl: "1+0" })).rejects.toThrow();
  });

  it("the room's timer ends the match on time without any client message", async () => {
    const { room, white, black } = await twoPlayers({ timeControl: "5+3" });
    // Jump the match's clock to 50 ms before White's flag, then make the room re-arm its timer
    // (any delivery does; a draw offer changes nothing else).
    const shift = 300_000 - 50;
    const realNow = room.match.now;
    room.match.now = () => realNow() + shift;
    black.c.send("offerDraw");
    await white.in.next("snapshot");

    const [w, b] = await Promise.all([white.in.next("events"), black.in.next("events")]);
    expect(w.events).toEqual([
      { type: "gameOver", status: { state: "won", winner: "black", reason: "timeout" } },
    ]);
    expect(b.snapshot.clocks).toMatchObject({ white: 0, running: null });
  });
});

describe("MatchRoom reconnection (R12, R13)", () => {
  it("a dropped player is held with a grace deadline, then comes back to the same seat", async () => {
    const { room, a, b, aSnap } = await twoPlayers();
    const bIn = inbox(b);
    const token = a.reconnectionToken;
    const before = Date.now();
    // Drop without consent. (The SDK only auto-reconnects rooms older than 5 s, so the test
    // reconnects explicitly with the token, as the web client will after a reload.)
    await a.leave(false);

    const dropped: MatchSnapshot = await bIn.next("snapshot");
    const gone = dropped.players.find((p) => p.color === aSnap.you);
    expect(gone?.connected).toBe(false);
    expect(gone?.graceEndsAt).toBeGreaterThanOrEqual(before + 60_000);
    expect(gone?.graceEndsAt).toBeLessThanOrEqual(Date.now() + 60_000);

    const a2 = await colyseus.sdk.reconnect(token);
    const a2In = inbox(a2);
    const [back, seen] = await Promise.all([a2In.next("snapshot"), bIn.next("snapshot")]);
    expect(a2.sessionId).toBe(a.sessionId);
    expect(back.you).toBe(aSnap.you);
    expect(back.state).toEqual(aSnap.state);
    expect(seen.players.find((p) => p.color === aSnap.you)).toMatchObject({
      connected: true,
      graceEndsAt: null,
    });
    expect(room.clients).toHaveLength(2);
  });

  it("after a deliberate leave the opponent can claim victory by abandonment", async () => {
    const { a, b, aSnap } = await twoPlayers();
    const bIn = inbox(b);
    await a.leave();
    await bIn.next("snapshot");
    b.send("claimVictory");
    const ev = await bIn.next("events");
    expect(ev.snapshot.state.status).toEqual({
      state: "won",
      winner: aSnap.you === "white" ? "black" : "white",
      reason: "abandonment",
    });
  });

  it("refuses a claim while the opponent is still connected", async () => {
    const { white } = await twoPlayers();
    white.c.send("claimVictory");
    expect((await white.in.next("error")).code).toBe("cannotClaim");
  });

  it("closes the room once both players are gone after the match", async () => {
    const { room, a, b } = await twoPlayers();
    a.send("resign");
    await inbox(b).next("events");
    await a.leave();
    await b.leave();
    await new Promise((r) => setTimeout(r, 100));
    expect(matchMaker.getLocalRoomById(room.roomId)).toBeUndefined();
  });
});

describe("MatchRoom rematch (PRD 5.5)", () => {
  it("starts game 2 in the same room with colours swapped once both ask", async () => {
    const { white, black, aSnap, room } = await twoPlayers({ timeControl: "untimed" });
    black.c.send("resign");
    await Promise.all([white.in.next("events"), black.in.next("events")]);

    white.c.send("rematch");
    const seen = await black.in.next("snapshot");
    expect(seen.rematchRequestedBy).toEqual(["white"]);
    await white.in.next("snapshot");

    black.c.send("rematch");
    const [w2, b2] = await Promise.all([white.in.next("snapshot"), black.in.next("snapshot")]);
    expect(w2.game).toBe(2);
    expect(w2.you).toBe("black");
    expect(b2.you).toBe("white");
    expect(w2.matchId).toBe(room.roomId);
    expect(w2.state.status).toEqual({ state: "active" });
    expect(w2.state.board).not.toEqual(aSnap.state.board);
  });
});
