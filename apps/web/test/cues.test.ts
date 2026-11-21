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
import { soundsFor } from "../src/audio/cues";

const ROLE: Record<string, Role> = { K: "king", Q: "queen", R: "rook", P: "pawn" };
const sq = parseSquare;
const HIT = 0.05; // dodge or crit succeeds
const MISS = 0.5; // dodge or crit fails

function game(pieces: Record<string, string>): GameState {
  const board = emptyBoard();
  for (const [s, code] of Object.entries(pieces)) {
    const [head = "", type = "Normal"] = code.split(":");
    board[sq(s)] = {
      id: s,
      color: head[0] === "w" ? "white" : "black",
      role: ROLE[head[1] ?? ""] ?? "pawn",
      species: "Test",
      type: type as PokemonType,
    };
  }
  const none = { kingSide: false, queenSide: false };
  return newGame({ board, turn: "white", castling: { white: none, black: none }, enPassant: null });
}

const base = { e1: "wK", e8: "bK", a2: "wP", h7: "bP" };
const mv = (from: string, to: string): Action => ({ type: "move", from: sq(from), to: sq(to) });
const cues = (
  pieces: Record<string, string>,
  action: Action,
  rolls: number[] = [],
  listener: "white" | "black" | null = null,
) =>
  soundsFor(
    applyAction(game({ ...base, ...pieces }), action, createScriptedRng(rolls)).events,
    listener,
  );

describe("soundsFor (PRD 7.1)", () => {
  it("a quiet move plays the move sound right away", () => {
    expect(cues({ d1: "wQ" }, mv("d1", "d4"))).toEqual([{ sfx: "move", at: "now" }]);
  });

  it("each battle outcome has its own sound, timed to the impact", () => {
    expect(cues({ d1: "wQ:Fighting", d8: "bR:Rock" }, mv("d1", "d8"), [MISS])).toEqual([
      { sfx: "superEffective", at: "impact" },
    ]);
    expect(cues({ d1: "wQ:Fire", d8: "bR:Water" }, mv("d1", "d8"), [MISS])).toEqual([
      { sfx: "notVeryEffective", at: "impact" },
    ]);
    expect(cues({ d1: "wQ", d8: "bR" }, mv("d1", "d8"), [HIT])).toEqual([
      { sfx: "dodge", at: "impact" },
    ]);
    expect(cues({ d1: "wQ:Normal", d8: "bR:Ghost" }, mv("d1", "d8"))).toEqual([
      { sfx: "immune", at: "impact" },
    ]);
    expect(cues({ d1: "wQ", d8: "bR" }, mv("d1", "d8"), [MISS, MISS])[0]?.sfx).toBe("capture");
    expect(cues({ d1: "wQ", d8: "bR" }, mv("d1", "d8"), [MISS, HIT])[0]?.sfx).toBe("critical");
  });

  it("a battle does not also play the move sound", () => {
    expect(cues({ d1: "wQ", d8: "bR" }, mv("d1", "d8"), [MISS, MISS]).map((c) => c.sfx)).toEqual([
      "capture",
    ]);
  });

  it("the end of a game sounds like victory or defeat for whoever is listening", () => {
    // White's queen takes the black king: White wins.
    const kingTaken = (listener: "white" | "black" | null) =>
      cues({ d1: "wQ", d8: "bR", e2: "wR" }, mv("e2", "e8"), [MISS, MISS], listener).map(
        (c) => `${c.sfx}@${c.at}`,
      );
    expect(kingTaken("white")).toEqual(["capture@impact", "victory@end"]);
    expect(kingTaken("black")).toEqual(["capture@impact", "defeat@end"]);
    expect(kingTaken(null)).toEqual(["capture@impact", "victory@end"]); // hot-seat
  });

  it("a resignation plays the result without a move sound; a draw is silent", () => {
    expect(cues({}, { type: "resign", color: "black" }, [], "white")).toEqual([
      { sfx: "victory", at: "end" },
    ]);
    expect(cues({}, { type: "agreeDraw" }, [], "white")).toEqual([]);
  });
});
