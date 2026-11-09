import {
  DEFAULT_BATTLE_CONFIG,
  resolveBattle,
  type BattleConfig,
  type BattleResult,
} from "./battle.js";
import {
  fileOf,
  opponent,
  rankOf,
  type Board,
  type Piece,
  type Position,
  type Square,
} from "./board.js";
import { legalMoves, movesFrom, PROMOTION_ROLES, type Move } from "./moves.js";
import type { Rng } from "./rng.js";
import type { Color, Role } from "./types.js";

/** 100 half-moves without a pawn move or completed capture is a draw (PRD 4.4). */
export const HALF_MOVE_LIMIT = 100;

export type WinReason = "kingCaptured" | "resignation" | "timeout" | "abandonment";
export type DrawReason = "stalemate" | "agreement" | "halfMoveLimit" | "doubleKnockout";

export type GameStatus =
  | { state: "active" }
  | { state: "won"; winner: Color; reason: WinReason }
  | { state: "draw"; reason: DrawReason };

export interface GameState extends Position {
  status: GameStatus;
  /** Half-moves since the last pawn move or completed capture (R9: bonus actions count). */
  halfMoveClock: number;
  /** Actions taken so far, including bonus actions. */
  ply: number;
  /** True when the side to move is on a bonus turn. */
  bonusTurn: boolean;
}

export type Action =
  | { type: "move"; from: Square; to: Square; promotion?: Role }
  | { type: "resign"; color: Color }
  | { type: "agreeDraw" }
  | { type: "timeout"; color: Color }
  | { type: "abandon"; color: Color };

export type GameEvent =
  | { type: "move"; color: Color; pieceId: string; from: Square; to: Square }
  | {
      type: "castle";
      color: Color;
      kingFrom: Square;
      kingTo: Square;
      rookFrom: Square;
      rookTo: Square;
    }
  | {
      type: "battle";
      color: Color;
      attackerId: string;
      defenderId: string;
      from: Square;
      to: Square;
      defenderSquare: Square;
      enPassant: boolean;
      result: BattleResult;
    }
  | { type: "promotion"; color: Color; pieceId: string; square: Square; role: Role }
  | { type: "bonusTurn"; color: Color }
  | { type: "gameOver"; status: Exclude<GameStatus, { state: "active" }> };

export interface ActionResult {
  state: GameState;
  events: GameEvent[];
}

export class IllegalActionError extends Error {}

export function newGame(position: Position): GameState {
  return { ...position, status: { state: "active" }, halfMoveClock: 0, ply: 0, bonusTurn: false };
}

const cloneState = (s: GameState): GameState => ({
  ...s,
  board: [...s.board] as Board,
  castling: { white: { ...s.castling.white }, black: { ...s.castling.black } },
});

/** Clears castling rights tied to a piece leaving or being removed from `sq`. */
function touchCastling(state: GameState, piece: Piece, sq: Square): void {
  const rights = state.castling[piece.color];
  const backRank = piece.color === "white" ? 0 : 7;
  if (piece.role === "king") {
    rights.kingSide = false;
    rights.queenSide = false;
  } else if (piece.role === "rook" && rankOf(sq) === backRank) {
    if (fileOf(sq) === 7) rights.kingSide = false;
    if (fileOf(sq) === 0) rights.queenSide = false;
  }
}

/**
 * Applies one action and returns the new state plus events for the battle log. Pure: the input
 * state is never mutated. Throws `IllegalActionError` for anything the rules don't allow.
 */
export function applyAction(
  prev: GameState,
  action: Action,
  rng: Rng,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG,
): ActionResult {
  if (prev.status.state !== "active") throw new IllegalActionError("The game is over");
  const state = cloneState(prev);
  const events: GameEvent[] = [];
  const end = (status: Exclude<GameStatus, { state: "active" }>): ActionResult => {
    state.status = status;
    state.bonusTurn = false;
    events.push({ type: "gameOver", status });
    return { state, events };
  };

  switch (action.type) {
    case "resign":
      return end({ state: "won", winner: opponent(action.color), reason: "resignation" });
    case "timeout":
      return end({ state: "won", winner: opponent(action.color), reason: "timeout" });
    case "abandon":
      return end({ state: "won", winner: opponent(action.color), reason: "abandonment" });
    case "agreeDraw":
      return end({ state: "draw", reason: "agreement" });
    case "move":
      break;
  }

  const mover = state.board[action.from];
  if (!mover || mover.color !== state.turn) throw new IllegalActionError("Not your piece");
  const move: Move | undefined = movesFrom(prev, action.from).find((m) => m.to === action.to);
  if (!move) throw new IllegalActionError("Illegal move");
  if (move.promotes && !PROMOTION_ROLES.includes(action.promotion as Role)) {
    throw new IllegalActionError("Promotion piece required");
  }

  const color = mover.color;
  state.enPassant = null; // Any action closes the window (R6); a double push reopens it below.
  state.ply += 1;
  let resetsClock = mover.role === "pawn";
  let bonus = false;
  let landed = false;

  if (move.kind === "move" || move.kind === "castle") {
    touchCastling(state, mover, move.from);
    state.board[move.from] = null;
    state.board[move.to] = mover;
    landed = true;
    if (move.kind === "castle" && move.rookFrom !== undefined && move.rookTo !== undefined) {
      const rook = state.board[move.rookFrom];
      state.board[move.rookFrom] = null;
      state.board[move.rookTo] = rook ?? null;
      events.push({
        type: "castle",
        color,
        kingFrom: move.from,
        kingTo: move.to,
        rookFrom: move.rookFrom,
        rookTo: move.rookTo,
      });
    } else {
      events.push({ type: "move", color, pieceId: mover.id, from: move.from, to: move.to });
    }
    if (mover.role === "pawn" && Math.abs(rankOf(move.to) - rankOf(move.from)) === 2) {
      state.enPassant = {
        target: (move.from + move.to) / 2,
        victim: move.to,
        availableTo: opponent(color),
      };
    }
  } else {
    const defenderSq = move.defender ?? move.to;
    const defender = state.board[defenderSq];
    if (!defender) throw new IllegalActionError("No defender");
    const result = resolveBattle(mover.type, defender.type, rng, config);
    events.push({
      type: "battle",
      color,
      attackerId: mover.id,
      defenderId: defender.id,
      from: move.from,
      to: move.to,
      defenderSquare: defenderSq,
      enPassant: move.kind === "enPassant",
      result,
    });

    if (result.defenderRemoved) {
      resetsClock = true;
      touchCastling(state, defender, defenderSq);
      state.board[defenderSq] = null;
    } else {
      resetsClock = false; // Failed captures never reset the clock (PRD 4.4).
    }
    if (result.attackerRemoved) {
      touchCastling(state, mover, move.from);
      state.board[move.from] = null;
    } else if (result.attackerMoves) {
      touchCastling(state, mover, move.from);
      state.board[move.from] = null;
      state.board[move.to] = mover;
      landed = true;
    }
    bonus = result.bonusTurn;

    const defenderKingGone = result.defenderRemoved && defender.role === "king";
    const attackerKingGone = result.attackerRemoved && mover.role === "king";
    if (defenderKingGone && attackerKingGone) {
      return end({ state: "draw", reason: "doubleKnockout" }); // R1
    }
    if (defenderKingGone) return end({ state: "won", winner: color, reason: "kingCaptured" }); // R2
    if (attackerKingGone) {
      return end({ state: "won", winner: opponent(color), reason: "kingCaptured" });
    }
  }

  if (landed && move.promotes && action.promotion) {
    state.board[move.to] = { ...mover, role: action.promotion };
    events.push({
      type: "promotion",
      color,
      pieceId: mover.id,
      square: move.to,
      role: action.promotion,
    });
  }

  state.halfMoveClock = resetsClock ? 0 : state.halfMoveClock + 1;
  state.bonusTurn = bonus;
  if (bonus) events.push({ type: "bonusTurn", color });
  else state.turn = opponent(color);

  if (state.halfMoveClock >= HALF_MOVE_LIMIT)
    return end({ state: "draw", reason: "halfMoveLimit" });
  if (legalMoves(state).length === 0) return end({ state: "draw", reason: "stalemate" });
  return { state, events };
}
