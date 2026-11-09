import type { Color, PokemonType, Role } from "./types.js";

/** Square index 0–63: a1 = 0, h1 = 7, a8 = 56, h8 = 63. */
export type Square = number;

export interface Piece {
  /** Unique per match, independent of species and role (PRD 2.3). */
  id: string;
  color: Color;
  role: Role;
  species: string;
  /** The single active type used for every battle. */
  type: PokemonType;
}

/** 64 entries indexed by `Square`; `null` is an empty square. */
export type Board = (Piece | null)[];

export interface CastlingRights {
  kingSide: boolean;
  queenSide: boolean;
}

export interface EnPassant {
  /** Square the capturing pawn moves to. */
  target: Square;
  /** Square of the pawn that may be captured (the battle's defender). */
  victim: Square;
  /** Only this side may use it, on its very next action (R6). */
  availableTo: Color;
}

export interface Position {
  board: Board;
  turn: Color;
  castling: Record<Color, CastlingRights>;
  enPassant: EnPassant | null;
}

const FILES = "abcdefgh";

export const fileOf = (s: Square): number => s & 7;
export const rankOf = (s: Square): number => s >> 3;

export function squareName(s: Square): string {
  return `${FILES[fileOf(s)]}${rankOf(s) + 1}`;
}

export function parseSquare(name: string): Square {
  const f = FILES.indexOf(name[0] ?? "");
  const r = Number(name[1]) - 1;
  if (name.length !== 2 || f < 0 || !(r >= 0 && r < 8)) throw new Error(`Bad square: ${name}`);
  return r * 8 + f;
}

export const opponent = (c: Color): Color => (c === "white" ? "black" : "white");

const BACK_RANK: Role[] = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];

export interface LayoutEntry {
  square: Square;
  color: Color;
  role: Role;
}

/** The 32 pieces of the standard starting position, white first. */
export function startingLayout(): LayoutEntry[] {
  const out: LayoutEntry[] = [];
  for (const color of ["white", "black"] as const) {
    const back = color === "white" ? 0 : 7;
    const pawns = color === "white" ? 1 : 6;
    BACK_RANK.forEach((role, f) => out.push({ square: back * 8 + f, color, role }));
    for (let f = 0; f < 8; f++) out.push({ square: pawns * 8 + f, color, role: "pawn" });
  }
  return out;
}

export function emptyBoard(): Board {
  return Array.from({ length: 64 }, () => null);
}

/** Starting position with Pokémon supplied by `assign` (the assignment module, or a test stub). */
export function createStartingPosition(
  assign: (entry: LayoutEntry, index: number) => Pick<Piece, "species" | "type">,
): Position {
  const board = emptyBoard();
  startingLayout().forEach((entry, i) => {
    const { species, type } = assign(entry, i);
    board[entry.square] = {
      id: `${entry.color[0]}${entry.role}-${squareName(entry.square)}`,
      color: entry.color,
      role: entry.role,
      species,
      type,
    };
  });
  return {
    board,
    turn: "white",
    castling: {
      white: { kingSide: true, queenSide: true },
      black: { kingSide: true, queenSide: true },
    },
    enPassant: null,
  };
}
