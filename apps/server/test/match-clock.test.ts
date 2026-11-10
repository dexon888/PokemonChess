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
const MISS = 0.5;

/** A started 5+3 match at t=0 with a controllable clock: "w" is White, "b" is Black. */
function timed(tc: TimeControlId = "5+3", rolls: number[] = []) {
  let t = 0;
  const match = new Match({
    matchId: "m",
    timeControl: tc,
    rng: createScriptedRng(rolls),
    setup: { position: position(BASE), firstJoinerColor: "white" },
    now: () => t,
  });
  match.join("w", "Ash");
  const start = match.join("b", "Gary");
  return {
    match,
    start,
    at(ms: number) {
      t = ms;
    },
  };
}

const move = (from: string, to: string): ClientMessage => ({
  type: "move",
  payload: { from: sq(from), to: sq(to) },
});
const payloadFor = <T>(out: Outbound[], who: string, type: Outbound["type"]) =>
  out.find((o) => o.to === who && o.type === type)?.payload as T | undefined;

describe("clocks (R11)", () => {
  it("untimed matches have no clock", () => {
    const m = new Match({
      matchId: "m",
      timeControl: "untimed",
      rng: createScriptedRng([]),
      setup: { position: position(BASE), firstJoinerColor: "white" },
    });
    m.join("w", "A");
    const snap = payloadFor<MatchSnapshot>(m.join("b", "B"), "w", "snapshot");
    expect(snap?.clocks).toBeNull();
    expect(m.msUntilFlag()).toBeNull();
    expect(m.tick()).toEqual([]);
  });

  it("starts White's clock when the match starts", () => {
    const { start } = timed();
    const snap = payloadFor<MatchSnapshot>(start, "w", "snapshot");
    expect(snap?.clocks).toEqual({ white: 300 * S, black: 300 * S, running: "white", at: 0 });
  });

  it("each move charges the mover, adds the increment and hands the clock over", () => {
    const { match, at } = timed();
    at(20 * S);
    const out = match.handle("w", move("d1", "d4"));
    const clocks = payloadFor<MatchEventsMessage>(out, "b", "events")?.snapshot.clocks;
    expect(clocks).toEqual({ white: 283 * S, black: 300 * S, running: "black", at: 20 * S });
  });

  it("a bonus action earns the increment and White's clock keeps running", () => {
    const { match, at } = timed("5+3", [MISS]); // Fighting queen takes Rock rook: 2×, bonus turn
    at(10 * S);
    const out = match.handle("w", move("d1", "d8"));
    const clocks = payloadFor<MatchEventsMessage>(out, "w", "events")?.snapshot.clocks;
    expect(clocks).toEqual({ white: 293 * S, black: 300 * S, running: "white", at: 10 * S });
  });

  it("the room's timer check ends the match on time and stops the clock", () => {
    const { match, at } = timed();
    at(299 * S);
    expect(match.tick()).toEqual([]);
    expect(match.msUntilFlag()).toBe(1 * S);

    at(300 * S);
    const out = match.tick();
    const ev = payloadFor<MatchEventsMessage>(out, "b", "events");
    expect(ev?.events).toEqual([
      { type: "gameOver", status: { state: "won", winner: "black", reason: "timeout" } },
    ]);
    expect(ev?.snapshot.clocks).toEqual({ white: 0, black: 300 * S, running: null, at: 300 * S });
    expect(match.msUntilFlag()).toBeNull();
    expect(match.log.at(-1)?.action).toEqual({ type: "timeout", color: "white" });
  });

  it("a move that arrives after the deadline loses on time instead of being played", () => {
    const { match, at } = timed();
    at(301 * S);
    const out = match.handle("w", move("d1", "d4"));
    const ev = payloadFor<MatchEventsMessage>(out, "w", "events");
    expect(ev?.snapshot.state.status).toEqual({
      state: "won",
      winner: "black",
      reason: "timeout",
    });
    expect(payloadFor(out, "w", "error")).toMatchObject({ code: "matchNotActive" });
    expect(match.state?.board[sq("d1")]?.role).toBe("queen"); // the move never happened
  });

  it("resigning stops the clock", () => {
    const { match, at } = timed();
    at(30 * S);
    const out = match.handle("b", { type: "resign", payload: {} });
    const clocks = payloadFor<MatchEventsMessage>(out, "w", "events")?.snapshot.clocks;
    expect(clocks).toEqual({ white: 270 * S, black: 300 * S, running: null, at: 30 * S });
    at(400 * S);
    expect(match.tick()).toEqual([]);
  });

  it("the clock keeps running while a player is disconnected (R12)", () => {
    const { match, at } = timed();
    at(5 * S);
    match.leave("w");
    at(300 * S);
    expect(
      payloadFor<MatchEventsMessage>(match.tick(), "b", "events")?.snapshot.state.status,
    ).toMatchObject({ winner: "black", reason: "timeout" });
  });
});
