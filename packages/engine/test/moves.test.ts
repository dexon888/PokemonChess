import { describe, expect, it } from "vitest";
import {
  createStartingPosition,
  kingThreatened,
  legalMoves,
  movesFrom,
  squareName,
} from "../src/index.js";
import { dests, position, sq } from "./helpers.js";

const both = { kingSide: true, queenSide: true };

describe("starting position", () => {
  const start = createStartingPosition(() => ({ species: "Test", type: "Normal" }));

  it("has 32 pieces with unique ids and White to move", () => {
    const pieces = start.board.filter((p) => p !== null);
    expect(pieces).toHaveLength(32);
    expect(new Set(pieces.map((p) => p.id)).size).toBe(32);
    expect(start.turn).toBe("white");
    expect(start.board[sq("e1")]?.role).toBe("king");
    expect(start.board[sq("d8")]?.role).toBe("queen");
  });

  it("gives White 20 opening moves, like standard chess", () => {
    expect(legalMoves(start)).toHaveLength(20);
  });
});

describe("piece movement", () => {
  it("knight jumps and ignores blockers", () => {
    const pos = position({ b1: "wN", a3: "wP", c3: "bP", d2: "wP" });
    expect(dests(movesFrom(pos, sq("b1")))).toEqual(["c3"]);
  });

  it("rook slides until blocked and captures the first enemy", () => {
    const pos = position({ d4: "wR", d6: "bP", d2: "wP", g4: "bN" });
    expect(dests(movesFrom(pos, sq("d4")))).toEqual(
      ["a4", "b4", "c4", "d3", "d5", "d6", "e4", "f4", "g4"].sort(),
    );
  });

  it("bishop and queen respect blockers", () => {
    const pos = position({ c1: "wB", d2: "wP", b2: "bP" });
    expect(dests(movesFrom(pos, sq("c1")))).toEqual(["b2"]);
    const q = position({ d4: "wQ" });
    expect(movesFrom(q, sq("d4"))).toHaveLength(27);
  });

  it("matches the game screen design: Machamp on d4 has 4 capture targets", () => {
    const pos = position({
      d4: "wQ:Fighting",
      d7: "bQ:Dragon",
      e5: "bP:Flying",
      b6: "bB:Ghost",
      g4: "bR:Rock",
      c3: "wN",
      e3: "wP",
    });
    const caps = movesFrom(pos, sq("d4")).filter((m) => m.kind === "capture");
    expect(dests(caps)).toEqual(["b6", "d7", "e5", "g4"]);
  });

  it("king can move into attacked squares and next to the enemy king", () => {
    const pos = position({ e4: "wK", e6: "bK", a5: "bR" });
    const d = dests(movesFrom(pos, sq("e4")));
    expect(d).toContain("e5");
    expect(d).toContain("d5");
    expect(d).toHaveLength(8);
  });

  it("kings can be captured", () => {
    const pos = position({ e4: "wK", e5: "bK" });
    expect(movesFrom(pos, sq("e4")).find((m) => m.to === sq("e5"))?.kind).toBe("capture");
  });

  it("includes captures of immune pieces as legal moves (R5)", () => {
    const pos = position({ a1: "wR:Normal", a8: "bR:Ghost" });
    expect(movesFrom(pos, sq("a1")).some((m) => m.kind === "capture" && m.to === sq("a8"))).toBe(
      true,
    );
  });
});

describe("pawns", () => {
  it("single and double push from the start rank, blocked when occupied", () => {
    expect(dests(movesFrom(position({ e2: "wP" }), sq("e2")))).toEqual(["e3", "e4"]);
    expect(dests(movesFrom(position({ e2: "wP", e4: "bP" }), sq("e2")))).toEqual(["e3"]);
    expect(dests(movesFrom(position({ e2: "wP", e3: "bP" }), sq("e2")))).toEqual([]);
    expect(dests(movesFrom(position({ d7: "bP" }, { turn: "black" }), sq("d7")))).toEqual([
      "d5",
      "d6",
    ]);
  });

  it("captures diagonally only", () => {
    const pos = position({ e4: "wP", d5: "bP", f5: "wP", e5: "bP" });
    expect(dests(movesFrom(pos, sq("e4")))).toEqual(["d5"]);
  });

  it("flags promotion on pushes and captures to the last rank", () => {
    const pos = position({ g7: "wP", h8: "bR" });
    const moves = movesFrom(pos, sq("g7"));
    expect(dests(moves)).toEqual(["g8", "h8"]);
    expect(moves.every((m) => m.promotes)).toBe(true);
  });

  it("en passant is offered to the right side with the passed pawn as defender", () => {
    const ep = { target: sq("d6"), victim: sq("d5"), availableTo: "white" as const };
    const pos = position({ e5: "wP", d5: "bP" }, { enPassant: ep });
    const m = movesFrom(pos, sq("e5")).find((x) => x.kind === "enPassant");
    expect(m && squareName(m.to)).toBe("d6");
    expect(m && squareName(m.defender ?? -1)).toBe("d5");

    const wrongSide = position(
      { e5: "wP", d5: "bP" },
      { enPassant: { ...ep, availableTo: "black" } },
    );
    expect(movesFrom(wrongSide, sq("e5")).some((x) => x.kind === "enPassant")).toBe(false);
  });
});

describe("castling", () => {
  it("both sides when rights exist and the path is empty", () => {
    const pos = position(
      { e1: "wK", a1: "wR", h1: "wR" },
      { castling: { white: both, black: { kingSide: false, queenSide: false } } },
    );
    const castles = movesFrom(pos, sq("e1")).filter((m) => m.kind === "castle");
    expect(dests(castles)).toEqual(["c1", "g1"]);
    const ks = castles.find((m) => squareName(m.to) === "g1");
    expect(ks && [squareName(ks.rookFrom ?? -1), squareName(ks.rookTo ?? -1)]).toEqual([
      "h1",
      "f1",
    ]);
  });

  it("is allowed while attacked and through attacked squares", () => {
    const pos = position(
      { e1: "wK", h1: "wR", e8: "bR", f8: "bR" },
      { castling: { white: both, black: { kingSide: false, queenSide: false } } },
    );
    expect(movesFrom(pos, sq("e1")).some((m) => m.kind === "castle")).toBe(true);
  });

  it("is blocked by pieces between, missing rights, or a missing rook", () => {
    const rights = { white: both, black: { kingSide: false, queenSide: false } };
    expect(
      movesFrom(position({ e1: "wK", h1: "wR", g1: "wN" }, { castling: rights }), sq("e1")).some(
        (m) => m.kind === "castle",
      ),
    ).toBe(false);
    expect(
      movesFrom(position({ e1: "wK", h1: "wR" }), sq("e1")).some((m) => m.kind === "castle"),
    ).toBe(false);
    expect(
      movesFrom(position({ e1: "wK", h1: "bR" }, { castling: rights }), sq("e1")).some(
        (m) => m.kind === "castle",
      ),
    ).toBe(false);
  });
});

describe("stalemate and king threat", () => {
  it("no legal moves when every piece is blocked", () => {
    const pos = position({ a1: "wP", a2: "bP" });
    expect(legalMoves(pos)).toEqual([]);
  });

  it("king threat ignores 0× attackers but counts ½× ones (R16)", () => {
    expect(kingThreatened(position({ e1: "wK:Ghost", e8: "bR:Normal" }), "white")).toBe(false);
    expect(kingThreatened(position({ e1: "wK:Steel", e8: "bR:Fire" }), "white")).toBe(true);
    expect(kingThreatened(position({ e1: "wK:Steel", e8: "bR:Grass" }), "white")).toBe(true);
    expect(kingThreatened(position({ e1: "wK", e8: "bR", e4: "wP" }), "white")).toBe(false);
  });
});
