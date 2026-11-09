import {
  emptyBoard,
  parseSquare,
  squareName,
  type Move,
  type Piece,
  type Position,
  type PokemonType,
  type Role,
} from "../src/index.js";

const ROLE: Record<string, Role> = {
  K: "king",
  Q: "queen",
  R: "rook",
  B: "bishop",
  N: "knight",
  P: "pawn",
};

/**
 * Builds a position from a compact map, e.g. `{ e1: "wK", e8: "bK:Ghost" }`.
 * Type defaults to Normal. Castling rights default to none unless given.
 */
export function position(
  pieces: Record<string, string>,
  opts: Partial<Omit<Position, "board">> = {},
): Position {
  const board = emptyBoard();
  for (const [sq, code] of Object.entries(pieces)) {
    const [head, type = "Normal"] = code.split(":");
    const color = head?.[0] === "w" ? "white" : "black";
    const role = ROLE[head?.[1] ?? ""];
    if (!role) throw new Error(`Bad piece code ${code}`);
    const piece: Piece = {
      id: `${sq}-${head}`,
      color,
      role,
      species: "Test",
      type: type as PokemonType,
    };
    board[parseSquare(sq)] = piece;
  }
  return {
    board,
    turn: "white",
    castling: {
      white: { kingSide: false, queenSide: false },
      black: { kingSide: false, queenSide: false },
    },
    enPassant: null,
    ...opts,
  };
}

/** Destination square names of a move list, sorted. */
export const dests = (moves: Move[]): string[] => moves.map((m) => squareName(m.to)).sort();

export const sq = parseSquare;
