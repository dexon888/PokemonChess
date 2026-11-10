import {
  emptyBoard,
  parseSquare,
  type Position,
  type PokemonType,
  type Role,
} from "@pokemon-chess/engine";

const ROLE: Record<string, Role> = {
  K: "king",
  Q: "queen",
  R: "rook",
  B: "bishop",
  N: "knight",
  P: "pawn",
};

/** `{ e1: "wK", d4: "wQ:Fighting" }` → a position; piece ids are the starting square. */
export function position(pieces: Record<string, string>): Position {
  const board = emptyBoard();
  for (const [s, code] of Object.entries(pieces)) {
    const [head = "", type = "Normal"] = code.split(":");
    board[parseSquare(s)] = {
      id: s,
      color: head[0] === "w" ? "white" : "black",
      role: ROLE[head[1] ?? ""] ?? "pawn",
      species: "Test",
      type: type as PokemonType,
    };
  }
  const none = { kingSide: false, queenSide: false };
  return { board, turn: "white", castling: { white: none, black: none }, enPassant: null };
}

export const sq = parseSquare;

/** A simple position: kings, a spare pawn each (so no stalemate), and a few attackers. */
export const BASE = {
  e1: "wK",
  e8: "bK",
  a2: "wP",
  h7: "bP",
  d1: "wQ:Fighting",
  d8: "bR:Rock",
};
