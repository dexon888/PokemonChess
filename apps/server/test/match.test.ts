import { createScriptedRng, createSeededRng } from "@pokemon-chess/engine";
import type { ClientMessage, MatchEventsMessage, MatchSnapshot } from "@pokemon-chess/protocol";
import { describe, expect, it } from "vitest";
import { Match, type Outbound } from "../src/match.js";
import { BASE, position, sq } from "./helpers.js";

const MISS = 0.5; // dodge or crit fails

/** A started match: "w" plays White, "b" plays Black. Battles use the scripted rolls. */
function started(pieces: Record<string, string> = BASE, rolls: number[] = []) {
  const match = new Match({
    matchId: "m1",
    timeControl: "untimed",
    rng: createScriptedRng(rolls),
    setup: { position: position(pieces), firstJoinerColor: "white" },
    now: () => 1000,
  });
  match.join("w", "Ash");
  match.join("b", "Gary");
  return match;
}

const send = (m: Match, who: string, msg: ClientMessage) => m.handle(who, msg);
const move = (from: string, to: string): ClientMessage => ({
  type: "move",
  payload: { from: sq(from), to: sq(to) },
});
const to = (out: Outbound[], who: string) => out.filter((o) => o.to === who);
const only = <T>(out: Outbound[], who: string, type: Outbound["type"]) => {
  const mine = to(out, who);
  expect(mine).toHaveLength(1);
  expect(mine[0]?.type).toBe(type);
  return mine[0]?.payload as T;
};

describe("starting a match", () => {
  it("waits for the second player, then sends each a personal snapshot", () => {
    const match = new Match({ matchId: "m1", timeControl: "untimed", rng: createSeededRng(7) });
    const waiting = match.join("a", "Ash");
    expect(waiting).toHaveLength(1);
    expect(waiting[0]).toMatchObject({
      to: "a",
      type: "lobby",
      payload: {
        roomId: "m1",
        private: false,
        timeControl: "untimed",
        players: [{ nickname: "Ash" }],
      },
    });
    expect(match.started).toBe(false);

    const out = match.join("b", "Gary");
    expect(match.started).toBe(true);
    const a = only<MatchSnapshot>(out, "a", "snapshot");
    const b = only<MatchSnapshot>(out, "b", "snapshot");
    expect(a.you).not.toBe(b.you);
    expect([a.you, b.you].sort()).toEqual(["black", "white"]);
    expect(a.state).toEqual(b.state);
    expect(a.state.board.filter(Boolean)).toHaveLength(32);
    expect(a.players.map((p) => p.nickname).sort()).toEqual(["Ash", "Gary"]);
    expect(a.seq).toBe(0);
  });

  it("rolls colours and Pokémon from the match RNG, so a seed reproduces them", () => {
    const run = (seed: number) => {
      const m = new Match({ matchId: "m", timeControl: "untimed", rng: createSeededRng(seed) });
      m.join("a", "A");
      return only<MatchSnapshot>(m.join("b", "B"), "a", "snapshot");
    };
    const rolled = (s: MatchSnapshot) => ({ state: s.state, players: s.players });
    expect(rolled(run(42))).toEqual(rolled(run(42)));
    const boards = new Set([1, 2, 3, 4, 5].map((s) => JSON.stringify(run(s).state.board)));
    expect(boards.size).toBe(5);
  });

  it("refuses a third player", () => {
    const match = started();
    expect(() => match.join("c", "Brock")).toThrow(/full/);
  });

  it("frees the seat when someone leaves before the match starts", () => {
    const match = new Match({ matchId: "m", timeControl: "untimed", rng: createSeededRng(1) });
    match.join("a", "Ash");
    match.leave("a");
    match.join("b", "Gary");
    expect(match.started).toBe(false);
  });
});

describe("moves", () => {
  it("applies a legal move and sends both players the same events with their own snapshot", () => {
    const match = started();
    const out = send(match, "w", move("d1", "d4"));
    const w = only<MatchEventsMessage>(out, "w", "events");
    const b = only<MatchEventsMessage>(out, "b", "events");
    expect(w.seq).toBe(1);
    expect(w.events).toEqual(b.events);
    expect(w.events[0]).toMatchObject({ type: "move", from: sq("d1"), to: sq("d4") });
    expect(w.snapshot.you).toBe("white");
    expect(b.snapshot.you).toBe("black");
    expect(w.snapshot.state.turn).toBe("black");
    expect(match.log).toHaveLength(1);
  });

  it("rejects moving out of turn and illegal moves without changing anything", () => {
    const match = started();
    expect(only(send(match, "b", move("d8", "d5")), "b", "error")).toMatchObject({
      code: "notYourTurn",
    });
    expect(only(send(match, "w", move("d1", "e3")), "w", "error")).toMatchObject({
      code: "illegalAction",
    });
    expect(only(send(match, "w", move("d8", "d5")), "w", "error")).toMatchObject({
      code: "illegalAction",
    });
    expect(match.log).toHaveLength(0);
    expect(match.state?.turn).toBe("white");
  });

  it("resolves battles with the match RNG and logs every roll", () => {
    // Fighting queen takes Rock rook on d8: 2× (only the dodge roll is used), bonus turn.
    const match = started(BASE, [MISS]);
    const w = only<MatchEventsMessage>(send(match, "w", move("d1", "d8")), "w", "events");
    const battle = w.events.find((e) => e.type === "battle");
    expect(battle).toMatchObject({ result: { outcome: "superEffective", bonusTurn: true } });
    expect(w.snapshot.state.turn).toBe("white"); // bonus turn
    expect(match.log[0]?.events).toEqual(w.events);
  });

  it("rejects messages from someone who is not seated", () => {
    const match = started();
    expect(only(send(match, "x", move("d1", "d4")), "x", "error")).toMatchObject({
      code: "notAPlayer",
    });
  });
});

describe("resigning and draws", () => {
  it("lets either player resign at any time and ends the match", () => {
    const match = started();
    const out = send(match, "b", { type: "resign", payload: {} });
    const w = only<MatchEventsMessage>(out, "w", "events");
    expect(w.snapshot.state.status).toEqual({
      state: "won",
      winner: "white",
      reason: "resignation",
    });
    expect(only(send(match, "w", move("d1", "d4")), "w", "error")).toMatchObject({
      code: "matchNotActive",
    });
  });

  it("an offer is shown to both; accepting ends in a draw", () => {
    const match = started();
    const offered = send(match, "w", { type: "offerDraw", payload: {} });
    expect(only<MatchSnapshot>(offered, "b", "snapshot").drawOfferFrom).toBe("white");

    const out = send(match, "b", { type: "answerDraw", payload: { accept: true } });
    const b = only<MatchEventsMessage>(out, "b", "events");
    expect(b.snapshot.state.status).toEqual({ state: "draw", reason: "agreement" });
    expect(b.snapshot.drawOfferFrom).toBeNull();
  });

  it("declining or making a move clears the offer; you cannot answer your own offer", () => {
    const match = started();
    send(match, "w", { type: "offerDraw", payload: {} });
    expect(
      only(send(match, "w", { type: "answerDraw", payload: { accept: true } }), "w", "error"),
    ).toMatchObject({ code: "illegalAction" });

    const declined = send(match, "b", { type: "answerDraw", payload: { accept: false } });
    expect(only<MatchSnapshot>(declined, "w", "snapshot").drawOfferFrom).toBeNull();

    send(match, "w", { type: "offerDraw", payload: {} });
    const moved = send(match, "w", move("d1", "d4"));
    expect(only<MatchEventsMessage>(moved, "b", "events").snapshot.drawOfferFrom).toBeNull();
  });

  it("two crossing offers agree the draw", () => {
    const match = started();
    send(match, "w", { type: "offerDraw", payload: {} });
    const out = send(match, "b", { type: "offerDraw", payload: {} });
    expect(only<MatchEventsMessage>(out, "w", "events").snapshot.state.status).toEqual({
      state: "draw",
      reason: "agreement",
    });
  });
});

describe("disconnects (before reconnection support)", () => {
  it("marks the player disconnected and tells the opponent", () => {
    const match = started();
    const out = match.leave("b");
    const w = only<MatchSnapshot>(out, "w", "snapshot");
    expect(w.players.find((p) => p.color === "black")?.connected).toBe(false);
  });
});

describe("lobby (PRD 6.6)", () => {
  it("tells everyone waiting who is in the room, including after someone leaves", () => {
    const match = new Match({
      matchId: "K7PQ2M",
      timeControl: "5+3",
      rng: createSeededRng(3),
      isPrivate: true,
      now: () => 500,
    });
    match.lobbyExpiresAt = 60_500;
    const first = match.join("a", "Ash");
    expect(first[0]?.payload).toEqual({
      roomId: "K7PQ2M",
      private: true,
      timeControl: "5+3",
      players: [{ nickname: "Ash" }],
      expiresAt: 60_500,
      serverTime: 500,
    });
    expect(match.leave("a")).toEqual([]); // nobody left to tell
  });

  it("stops sending lobby updates once the match starts", () => {
    const match = new Match({ matchId: "m", timeControl: "untimed", rng: createSeededRng(3) });
    match.join("a", "Ash");
    const out = match.join("b", "Gary");
    expect(out.map((o) => o.type)).toEqual(["snapshot", "snapshot"]);
  });
});
