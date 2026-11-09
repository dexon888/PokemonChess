import { fileOf, opponent, rankOf, type Position, type Square } from "./board.js";
import { effectiveness } from "./typechart.js";
import type { Color, Role } from "./types.js";

export type MoveKind = "move" | "capture" | "enPassant" | "castle";

export interface Move {
  from: Square;
  to: Square;
  kind: MoveKind;
  /** Square of the defending piece: `to` for captures, the passed pawn for en passant. */
  defender?: Square;
  /** Rook squares for castling. */
  rookFrom?: Square;
  rookTo?: Square;
  /** A pawn reaching the last rank; the promotion role is sent with the intent (R8). */
  promotes?: boolean;
}

export const PROMOTION_ROLES: readonly Role[] = ["queen", "rook", "bishop", "knight"];

const KNIGHT: [number, number][] = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];
const KING: [number, number][] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];
const ROOK_DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const BISHOP_DIRS: [number, number][] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function offset(s: Square, df: number, dr: number): Square | null {
  const f = fileOf(s) + df;
  const r = rankOf(s) + dr;
  return f >= 0 && f < 8 && r >= 0 && r < 8 ? r * 8 + f : null;
}

/**
 * Every legal action for the piece on `from`. There is no check rule, so pseudo-legal moves are
 * legal: kings may move into attack, and captures of immune pieces are included (R5).
 */
export function movesFrom(pos: Position, from: Square): Move[] {
  const piece = pos.board[from];
  if (!piece) return [];
  const { color } = piece;
  const out: Move[] = [];

  const step = (to: Square | null) => {
    if (to === null) return;
    const target = pos.board[to];
    if (!target) out.push({ from, to, kind: "move" });
    else if (target.color !== color) out.push({ from, to, kind: "capture", defender: to });
  };
  const slide = (dirs: [number, number][]) => {
    for (const [df, dr] of dirs) {
      let to = offset(from, df, dr);
      while (to !== null) {
        const target = pos.board[to];
        if (!target) out.push({ from, to, kind: "move" });
        else {
          if (target.color !== color) out.push({ from, to, kind: "capture", defender: to });
          break;
        }
        to = offset(to, df, dr);
      }
    }
  };

  switch (piece.role) {
    case "knight":
      KNIGHT.forEach(([df, dr]) => step(offset(from, df, dr)));
      break;
    case "bishop":
      slide(BISHOP_DIRS);
      break;
    case "rook":
      slide(ROOK_DIRS);
      break;
    case "queen":
      slide([...ROOK_DIRS, ...BISHOP_DIRS]);
      break;
    case "king":
      KING.forEach(([df, dr]) => step(offset(from, df, dr)));
      out.push(...castlingMoves(pos, from, color));
      break;
    case "pawn":
      out.push(...pawnMoves(pos, from, color));
      break;
  }
  return out;
}

function pawnMoves(pos: Position, from: Square, color: Color): Move[] {
  const dir = color === "white" ? 1 : -1;
  const startRank = color === "white" ? 1 : 6;
  const lastRank = color === "white" ? 7 : 0;
  const out: Move[] = [];
  const add = (m: Move) => out.push(rankOf(m.to) === lastRank ? { ...m, promotes: true } : m);

  const one = offset(from, 0, dir);
  if (one !== null && !pos.board[one]) {
    add({ from, to: one, kind: "move" });
    const two = offset(from, 0, 2 * dir);
    if (rankOf(from) === startRank && two !== null && !pos.board[two]) {
      out.push({ from, to: two, kind: "move" });
    }
  }
  for (const df of [-1, 1]) {
    const to = offset(from, df, dir);
    if (to === null) continue;
    const target = pos.board[to];
    if (target && target.color !== color) add({ from, to, kind: "capture", defender: to });
    const ep = pos.enPassant;
    if (ep && ep.availableTo === color && ep.target === to && !target) {
      out.push({ from, to, kind: "enPassant", defender: ep.victim });
    }
  }
  return out;
}

function castlingMoves(pos: Position, from: Square, color: Color): Move[] {
  const home = color === "white" ? 4 : 60;
  if (from !== home) return [];
  const rights = pos.castling[color];
  const out: Move[] = [];
  const sides = [
    {
      ok: rights.kingSide,
      rook: home + 3,
      between: [home + 1, home + 2],
      to: home + 2,
      rookTo: home + 1,
    },
    {
      ok: rights.queenSide,
      rook: home - 4,
      between: [home - 1, home - 2, home - 3],
      to: home - 2,
      rookTo: home - 1,
    },
  ];
  for (const s of sides) {
    const rook = pos.board[s.rook];
    if (!s.ok || rook?.role !== "rook" || rook.color !== color) continue;
    if (s.between.some((sq) => pos.board[sq])) continue;
    // No attack checks: castling through or into attacked squares is allowed (PRD 4.1).
    out.push({ from, to: s.to, kind: "castle", rookFrom: s.rook, rookTo: s.rookTo });
  }
  return out;
}

/** All legal actions for the side to move. An empty list is stalemate. */
export function legalMoves(pos: Position): Move[] {
  const out: Move[] = [];
  pos.board.forEach((p, sq) => {
    if (p && p.color === pos.turn) out.push(...movesFrom(pos, sq));
  });
  return out;
}

/**
 * King-threat cue (R16): true if any enemy piece has a capture on `color`'s king that is not 0×.
 * Audiovisual only; it never restricts moves.
 */
export function kingThreatened(pos: Position, color: Color): boolean {
  const kingSq = pos.board.findIndex((p) => p?.color === color && p.role === "king");
  const king = pos.board[kingSq];
  if (!king) return false;
  const enemy = opponent(color);
  const asEnemy: Position = { ...pos, turn: enemy, enPassant: null };
  return pos.board.some((p, sq) => {
    if (!p || p.color !== enemy) return false;
    return movesFrom(asEnemy, sq).some(
      (m) => m.kind === "capture" && m.to === kingSq && effectiveness(p.type, king.type) !== 0,
    );
  });
}
