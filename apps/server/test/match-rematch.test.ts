import { createScriptedRng } from "@pokemon-chess/engine";
import type {
  ClientMessage,
  MatchEventsMessage,
  MatchSnapshot,
  TimeControlId,
} from "@pokemon-chess/protocol";
import { describe, expect, it } from "vitest";
import { Match, type Outbound } from "../src/match.js";
import { BASE, position, sq } from "./helpers.js";

const S = 1000;
const HIT = 0.05; // dodge succeeds
const MISS = 0.5; // dodge or crit fails

/** A started match at t=0: "w" plays White, "b" plays Black. Battles use the scripted rolls. */
function started(tc: TimeControlId = "untimed", rolls: number[] = []) {
  let t = 0;
  const match = new Match({
    matchId: "m",
    timeControl: tc,
    rng: createScriptedRng(rolls),
    setup: { position: position(BASE), firstJoinerColor: "white" },
    now: () => t,
  });
  match.join("w", "Ash");
  match.join("b", "Gary");
  return {
    match,
    at(ms: number) {
      t = ms;
    },
  };
}

const rematch: ClientMessage = { type: "rematch", payload: {} };
const resign: ClientMessage = { type: "resign", payload: {} };
const move = (from: string, to: string): ClientMessage => ({
  type: "move",
  payload: { from: sq(from), to: sq(to) },
});
const snap = (out: Outbound[], who: string) =>
  out.find((o) => o.to === who && o.type === "snapshot")?.payload as MatchSnapshot | undefined;
const events = (out: Outbound[], who: string) =>
  out.find((o) => o.to === who && o.type === "events")?.payload as MatchEventsMessage | undefined;
const err = (out: Outbound[], who: string) =>
  out.find((o) => o.to === who && o.type === "error")?.payload;

describe("rematch (PRD 5.5)", () => {
  it("is refused while the game is still going", () => {
    const { match } = started();
    expect(err(match.handle("w", rematch), "w")).toMatchObject({ code: "matchNotActive" });
  });

  it("shows one player's request to both, without starting anything", () => {
    const { match } = started();
    match.handle("b", resign);
    const out = match.handle("w", rematch);
    expect(snap(out, "b")?.rematchRequestedBy).toEqual(["white"]);
    expect(snap(out, "b")?.game).toBe(1);
    // Asking again changes nothing.
    expect(snap(match.handle("w", rematch), "b")?.rematchRequestedBy).toEqual(["white"]);
  });

  it("starts game 2 when both ask: colours swap (R19), a fresh board, an empty log", () => {
    const { match } = started();
    match.handle("w", move("d1", "d4"));
    match.handle("b", resign);
    match.handle("w", rematch);
    const out = match.handle("b", rematch);

    const ash = snap(out, "w");
    const gary = snap(out, "b");
    expect(ash?.game).toBe(2);
    expect(ash?.you).toBe("black");
    expect(gary?.you).toBe("white");
    expect(ash?.state.status).toEqual({ state: "active" });
    expect(ash?.state.ply).toBe(0);
    expect(ash?.state.board[sq("d1")]?.role).toBe("queen");
    expect(ash?.seq).toBe(0);
    expect(ash?.rematchRequestedBy).toEqual([]);
    expect(match.log).toHaveLength(0);
    expect(match.pastLogs).toHaveLength(1);
    expect(match.pastLogs[0]).toHaveLength(2);

    // Gary now moves first, as White.
    expect(err(match.handle("w", move("d1", "d4")), "w")).toMatchObject({ code: "notYourTurn" });
    expect(events(match.handle("b", move("d1", "d4")), "w")?.seq).toBe(1);
  });

  it("restarts the clocks for the new game", () => {
    const { match, at } = started("5+3");
    at(100 * S);
    match.handle("b", resign);
    at(130 * S);
    match.handle("w", rematch);
    const out = match.handle("b", rematch);
    expect(snap(out, "w")?.clocks).toEqual({
      white: 300 * S,
      black: 300 * S,
      running: "white",
      at: 130 * S,
    });
  });

  it("rolls new Pokémon for the new game", () => {
    // Without a fixed setup, the match rolls a new position from its RNG.
    let i = 0;
    const rolls = { next: () => (i++ * 0.6180339887) % 1 };
    const match = new Match({ matchId: "m", timeControl: "untimed", rng: rolls });
    match.join("a", "Ash");
    const first = snap(match.join("b", "Gary"), "a")?.state.board;
    match.handle("a", resign);
    match.handle("a", rematch);
    const second = snap(match.handle("b", rematch), "a")?.state.board;
    expect(second).not.toEqual(first);
  });
});

describe("match stats (PRD 6.7)", () => {
  it("count captures and super-effective hits for the attacker, dodges for the defender", () => {
    // Fighting queen d1 attacks Rock rook d8: the first try is dodged, so it plays on.
    const { match } = started("untimed", [HIT, MISS]);
    const dodged = events(match.handle("w", move("d1", "d8")), "w");
    expect(dodged?.snapshot.stats.black.dodges).toBe(1);

    match.handle("b", move("h7", "h6"));
    const hit = events(match.handle("w", move("d1", "d8")), "w");
    expect(hit?.snapshot.stats.white).toEqual({
      captures: 1,
      superEffective: 1,
      crits: 0,
      dodges: 0,
    });
  });

  it("start from zero in a rematch", () => {
    const { match } = started("untimed", [MISS]);
    match.handle("w", move("d1", "d8"));
    match.handle("b", resign);
    match.handle("w", rematch);
    const out = match.handle("b", rematch);
    expect(snap(out, "w")?.stats.white.captures).toBe(0);
    expect(snap(out, "w")?.stats.black.captures).toBe(0);
  });
});
