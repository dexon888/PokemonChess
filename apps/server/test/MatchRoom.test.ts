import { boot, type ColyseusTestServer } from "@colyseus/testing";
import type { ErrorMessage, MatchSnapshot, ServerMessages } from "@pokemon-chess/protocol";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import appConfig from "../src/app.config.js";
import type { MatchRoom } from "../src/MatchRoom.js";

/**
 * End-to-end over a real WebSocket: two SDK clients join one MatchRoom. Battle outcomes here use
 * the room's own seeded RNG, so these tests check wiring and agreement between the two clients;
 * exact outcomes are covered by match.test.ts with scripted rolls.
 */

type SdkRoom = Awaited<ReturnType<ColyseusTestServer["connectTo"]>>;

/** Collects every message a client receives, by type, and lets a test await the next one. */
function inbox(room: SdkRoom) {
  const seen: { type: string; payload: unknown }[] = [];
  const waiters: { type: string; resolve: (p: unknown) => void }[] = [];
  room.onMessage("*", (type: string | number, payload: unknown) => {
    const w = waiters.findIndex((x) => x.type === type);
    if (w >= 0) waiters.splice(w, 1)[0]?.resolve(payload);
    else seen.push({ type: String(type), payload });
  });
  return {
    next<K extends keyof ServerMessages>(type: K, timeoutMs = 2000): Promise<ServerMessages[K]> {
      const i = seen.findIndex((m) => m.type === type);
      if (i >= 0) return Promise.resolve(seen.splice(i, 1)[0]?.payload as ServerMessages[K]);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`No "${type}" within ${timeoutMs}ms`)),
          timeoutMs,
        );
        waiters.push({
          type,
          resolve: (p) => {
            clearTimeout(timer);
            resolve(p as ServerMessages[K]);
          },
        });
      });
    },
  };
}

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
