import {
  applyAction,
  createScriptedRng,
  emptyBoard,
  newGame,
  parseSquare,
  type Action,
  type GameState,
  type PokemonType,
  type Role,
} from "@pokemon-chess/engine";
import { describe, expect, it } from "vitest";
import { emptyBothStats, narrate } from "../src/game/narrate";

const ROLE: Record<string, Role> = { K: "king", Q: "queen", R: "rook", P: "pawn" };
const sq = parseSquare;
const HIT = 0.05;
const MISS = 0.5;

function game(pieces: Record<string, string>): GameState {
  const board = emptyBoard();
  for (const [s, code] of Object.entries(pieces)) {
    const [head = "", type = "Normal", species = "Test"] = code.split(":");
    board[sq(s)] = {
      id: s,
      color: head[0] === "w" ? "white" : "black",
      role: ROLE[head[1] ?? ""] ?? "pawn",
      species,
      type: type as PokemonType,
    };
  }
  const none = { kingSide: false, queenSide: false };
  return newGame({ board, turn: "white", castling: { white: none, black: none }, enPassant: null });
}

let id = 0;
const next = () => ++id;
const run = (g: GameState, action: Action, rolls: number[] = []) => {
  const { events } = applyAction(g, action, createScriptedRng(rolls));
  return narrate(g, events, emptyBothStats(), next);
};
const base = { e1: "wK", e8: "bK", a2: "wP", h7: "bP" };
const mv = (from: string, to: string): Action => ({ type: "move", from: sq(from), to: sq(to) });

describe("narrate", () => {
  it("describes a quiet move and marks it as the last move", () => {
    const n = run(game({ ...base, d1: "wQ:Normal:Snorlax" }), mv("d1", "d4"));
    expect(n.entries.map((e) => e.text)).toEqual(["Snorlax moved d1 → d4."]);
    expect(n.lastMove).toEqual({ from: sq("d1"), to: sq("d4") });
    expect(n.banner).toBeNull();
  });

  it("a super-effective capture: banner, hit square, stats and a bonus-turn line", () => {
    const g = game({ ...base, d1: "wQ:Fighting:Machamp", d8: "bR:Rock:Onix" });
    const n = run(g, mv("d1", "d8"), [MISS]);
    expect(n.banner).toMatchObject({ outcome: "superEffective", title: "Super effective!" });
    expect(n.hit).toMatchObject({ sq: sq("d8"), kind: "superEffective" });
    expect(n.stats.white).toMatchObject({ captures: 1, superEffective: 1 });
    // Newest first: the bonus line comes after the capture.
    expect(n.entries.map((e) => e.tag)).toEqual(["BONUS", "2×"]);
    expect(n.lastMove).toEqual({ from: sq("d1"), to: sq("d8") });
  });

  it("a dodge counts for the defender", () => {
    const n = run(game({ ...base, d1: "wQ", d8: "bR" }), mv("d1", "d8"), [HIT]);
    expect(n.stats.black.dodges).toBe(1);
    expect(n.banner?.title).toBe("Dodged!");
  });

  it("describes the end of the game, including the new online endings", () => {
    const g = game(base);
    for (const [action, text] of [
      [{ type: "resign", color: "black" }, "White wins by resignation."],
      [{ type: "timeout", color: "white" }, "Black wins by timeout."],
      [{ type: "abandon", color: "black" }, "White wins by abandonment."],
      [{ type: "agreeDraw" }, "Draw by agreement."],
    ] as [Action, string][]) {
      expect(run(g, action).entries[0]?.text).toBe(text);
    }
  });

  it("does not change the stats it was given", () => {
    const stats = emptyBothStats();
    const g = game({ ...base, d1: "wQ:Fighting", d8: "bR:Rock" });
    const { events } = applyAction(g, mv("d1", "d8"), createScriptedRng([MISS]));
    narrate(g, events, stats, next);
    expect(stats.white.captures).toBe(0);
  });
});
