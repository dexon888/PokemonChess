import {
  applyAction,
  createScriptedRng,
  emptyBoard,
  newGame,
  parseSquare,
  type GameState,
  type PokemonType,
  type Role,
} from "@pokemon-chess/engine";
import { describe, expect, it } from "vitest";
import { LUNGE_MS, motionFromEvents, SLIDE_MS } from "../src/game/motion";

const ROLE: Record<string, Role> = {
  K: "king",
  Q: "queen",
  R: "rook",
  B: "bishop",
  N: "knight",
  P: "pawn",
};
const sq = parseSquare;
const HIT = 0.05; // dodge succeeds
const MISS = 0.5; // dodge or crit fails

/** `{ e1: "wK", d4: "wQ:Fighting" }` → a game; piece ids are the starting square. */
function game(pieces: Record<string, string>, castling = false): GameState {
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
  const rights = { kingSide: castling, queenSide: false };
  return newGame({
    board,
    turn: "white",
    castling: { white: rights, black: { kingSide: false, queenSide: false } },
    enPassant: null,
  });
}

function motionOf(g: GameState, from: string, to: string, rolls: number[] = []) {
  const { events } = applyAction(
    g,
    { type: "move", from: sq(from), to: sq(to) },
    createScriptedRng(rolls),
  );
  return motionFromEvents(g, events, 1);
}

const base = { e1: "wK", e8: "bK", a2: "wP", h7: "bP" };

describe("motionFromEvents", () => {
  it("slides a quiet move with no impact delay", () => {
    const m = motionOf(game({ ...base, d1: "wQ" }), "d1", "d4");
    expect([...m.slides]).toEqual([["d1", { from: sq("d1"), to: sq("d4") }]]);
    expect(m.ghosts).toEqual([]);
    expect(m.impactDelay).toBe(0);
  });

  it("slides both king and rook when castling", () => {
    const m = motionOf(game({ ...base, h1: "wR" }, true), "e1", "g1");
    expect(m.slides.get("e1")).toEqual({ from: sq("e1"), to: sq("g1") });
    expect(m.slides.get("h1")).toEqual({ from: sq("h1"), to: sq("f1") });
  });

  it("a capture slides the attacker and fades the defender after the slide", () => {
    const m = motionOf(game({ ...base, d4: "wQ:Fighting", g4: "bR:Rock" }), "d4", "g4", [MISS]);
    expect(m.slides.get("d4")).toEqual({ from: sq("d4"), to: sq("g4") });
    expect(m.ghosts).toMatchObject([{ piece: { id: "g4" }, square: sq("g4") }]);
    expect(m.impactDelay).toBe(SLIDE_MS);
  });

  it("a dodge makes the attacker lunge in place and removes nothing", () => {
    const m = motionOf(game({ ...base, d4: "wQ", g4: "bR" }), "d4", "g4", [HIT]);
    expect(m.slides.size).toBe(0);
    expect(m.lunges.get("d4")).toEqual({ from: sq("d4"), toward: sq("g4") });
    expect(m.ghosts).toEqual([]);
    expect(m.impactDelay).toBe(LUNGE_MS / 2);
  });

  it("an immune target also gets a lunge, with no roll consumed", () => {
    const m = motionOf(game({ ...base, d4: "wQ:Normal", g4: "bR:Ghost" }), "d4", "g4");
    expect(m.lunges.has("d4")).toBe(true);
  });

  it("a ½× trade turns both pieces into ghosts; the attacker's slides in first", () => {
    const m = motionOf(game({ ...base, d4: "wQ:Fire", g4: "bR:Water" }), "d4", "g4", [MISS]);
    expect(m.slides.size).toBe(0);
    expect(m.ghosts).toMatchObject([
      { piece: { id: "d4" }, square: sq("g4"), slideFrom: sq("d4") },
      { piece: { id: "g4" }, square: sq("g4") },
    ]);
  });

  it("en passant fades the passed pawn on its own square, not the landing square", () => {
    let g = game({ ...base, e5: "wP", d7: "bP" });
    g = { ...g, turn: "black" };
    g = applyAction(g, { type: "move", from: sq("d7"), to: sq("d5") }, createScriptedRng([])).state;
    const m = motionOf(g, "e5", "d6", [MISS, MISS]);
    expect(m.slides.get("e5")).toEqual({ from: sq("e5"), to: sq("d6") });
    expect(m.ghosts).toMatchObject([{ piece: { id: "d7" }, square: sq("d5") }]);
  });
});
