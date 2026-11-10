import { createScriptedRng } from "@pokemon-chess/engine";
import {
  RECONNECT_GRACE_MS,
  type ClientMessage,
  type MatchEventsMessage,
  type MatchSnapshot,
  type TimeControlId,
} from "@pokemon-chess/protocol";
import { describe, expect, it } from "vitest";
import { Match, type Outbound } from "../src/match.js";
import { BASE, position, sq } from "./helpers.js";

const S = 1000;
const GRACE = RECONNECT_GRACE_MS;

/** A started match at t=0 with a controllable clock: "w" is White, "b" is Black. */
function started(tc: TimeControlId = "untimed") {
  let t = 0;
  const match = new Match({
    matchId: "m",
    timeControl: tc,
    rng: createScriptedRng([]),
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

const claim: ClientMessage = { type: "claimVictory", payload: {} };
const get = <T>(out: Outbound[], who: string, type: Outbound["type"]) =>
  out.find((o) => o.to === who && o.type === type)?.payload as T | undefined;
const player = (snap: MatchSnapshot | undefined, color: "white" | "black") =>
  snap?.players.find((p) => p.color === color);

describe("disconnect and grace (R12)", () => {
  it("tells the opponent, with the grace deadline and the server time", () => {
    const { match, at } = started();
    at(10 * S);
    const snap = get<MatchSnapshot>(match.disconnect("b"), "w", "snapshot");
    expect(player(snap, "black")).toMatchObject({ connected: false, graceEndsAt: 10 * S + GRACE });
    expect(snap?.serverTime).toBe(10 * S);
  });

  it("wakes the room when the grace runs out and tells both players once", () => {
    const { match, at } = started();
    match.disconnect("b");
    at(GRACE - 1);
    expect(match.msUntilWake()).toBe(1);
    expect(match.tick()).toEqual([]);
    at(GRACE);
    expect(get<MatchSnapshot>(match.tick(), "w", "snapshot")).toBeDefined();
    expect(match.tick()).toEqual([]); // announced once
    expect(match.msUntilWake()).toBeNull();
  });

  it("the clock keeps running for a disconnected player and can still flag", () => {
    const { match, at } = started("5+3");
    match.disconnect("w");
    expect(match.msUntilWake()).toBe(GRACE); // grace ends before White's 5 minutes
    at(300 * S);
    const ev = get<MatchEventsMessage>(match.tick(), "b", "events");
    expect(ev?.snapshot.state.status).toMatchObject({ winner: "black", reason: "timeout" });
  });
});

describe("reconnecting (R13)", () => {
  it("restores the seat and sends the latest state, without re-rolling anything", () => {
    const { match, at } = started();
    match.handle("w", { type: "move", payload: { from: sq("d1"), to: sq("d4") } });
    match.disconnect("w");
    at(20 * S);
    const out = match.reconnect("w");
    const mine = get<MatchSnapshot>(out, "w", "snapshot");
    expect(mine?.you).toBe("white");
    expect(mine?.seq).toBe(1);
    expect(mine?.state.board[sq("d4")]?.role).toBe("queen");
    expect(player(mine, "white")).toMatchObject({ connected: true, graceEndsAt: null });
    expect(get<MatchSnapshot>(out, "b", "snapshot")).toBeDefined();
    expect(match.log).toHaveLength(1);
  });

  it("can come back after the grace if the opponent kept waiting", () => {
    const { match, at } = started();
    match.disconnect("b");
    at(GRACE + 30 * S);
    match.tick();
    const snap = get<MatchSnapshot>(match.reconnect("b"), "w", "snapshot");
    expect(player(snap, "black")?.connected).toBe(true);
    expect(get(match.handle("w", claim), "w", "error")).toMatchObject({ code: "cannotClaim" });
  });
});

describe("claiming victory", () => {
  it("is refused while the opponent is connected or still within the grace", () => {
    const { match, at } = started();
    expect(get(match.handle("w", claim), "w", "error")).toMatchObject({ code: "cannotClaim" });
    match.disconnect("b");
    at(GRACE - 1);
    expect(get(match.handle("w", claim), "w", "error")).toMatchObject({ code: "cannotClaim" });
  });

  it("after the grace, wins by abandonment through the engine", () => {
    const { match, at } = started();
    match.disconnect("b");
    at(GRACE);
    const ev = get<MatchEventsMessage>(match.handle("w", claim), "w", "events");
    expect(ev?.events).toEqual([
      { type: "gameOver", status: { state: "won", winner: "white", reason: "abandonment" } },
    ]);
    expect(player(ev?.snapshot, "black")?.graceEndsAt).toBeNull();
    expect(match.log.at(-1)?.action).toEqual({ type: "abandon", color: "black" });
  });

  it("works at once after a deliberate leave, since that player is not coming back", () => {
    const { match } = started();
    match.leave("b");
    const ev = get<MatchEventsMessage>(match.handle("w", claim), "w", "events");
    expect(ev?.snapshot.state.status).toMatchObject({ winner: "white", reason: "abandonment" });
  });
});

describe("closing the room", () => {
  it("everyone is gone once both have left and nothing can be claimed", () => {
    const { match, at } = started();
    match.disconnect("w");
    match.disconnect("b");
    expect(match.everyoneGone()).toBe(false); // both still within grace
    at(GRACE);
    expect(match.everyoneGone()).toBe(true);
  });

  it("after the game ends, everyone is gone as soon as nobody is connected", () => {
    const { match } = started();
    match.handle("b", { type: "resign", payload: {} });
    match.disconnect("w");
    expect(match.everyoneGone()).toBe(false);
    match.disconnect("b");
    expect(match.everyoneGone()).toBe(true);
  });

  it("a drop before the match starts frees the seat like a leave", () => {
    const match = new Match({ matchId: "m", timeControl: "untimed", rng: createScriptedRng([]) });
    match.join("a", "Ash");
    match.disconnect("a");
    match.join("b", "Gary");
    expect(match.started).toBe(false);
  });
});
