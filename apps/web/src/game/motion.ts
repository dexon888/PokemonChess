import type { GameEvent, GameState, Piece, Square } from "@pokemon-chess/engine";

/** Timing for board motion, in milliseconds. */
export const SLIDE_MS = 240;
export const LUNGE_MS = 280;
export const FADE_MS = 260;

/** A piece that left the board in this action. It is drawn as a fading "ghost". */
export interface Ghost {
  piece: Piece;
  /** Square the ghost fades out on. */
  square: Square;
  /** When set, the ghost first slides here from this square (a ½× attacker). */
  slideFrom?: Square;
}

/**
 * What the board should animate after one action. Built only from the events the engine (and,
 * from M4, the server) reports, so the client never infers an outcome on its own.
 */
export interface Motion {
  id: number;
  /** Pieces that end the action on a new square, by piece id. */
  slides: Map<string, { from: Square; to: Square }>;
  /** Attackers that stay put (dodged or immune) and only lunge toward the target. */
  lunges: Map<string, { from: Square; toward: Square }>;
  ghosts: Ghost[];
  /** Delay before the defender reacts, so the hit lands when the attacker arrives. */
  impactDelay: number;
}

export function motionFromEvents(before: GameState, events: GameEvent[], id: number): Motion {
  const byId = new Map<string, Piece>();
  before.board.forEach((p) => p && byId.set(p.id, p));
  const motion: Motion = { id, slides: new Map(), lunges: new Map(), ghosts: [], impactDelay: 0 };

  for (const e of events) {
    switch (e.type) {
      case "move":
        motion.slides.set(e.pieceId, { from: e.from, to: e.to });
        break;
      case "castle": {
        const king = before.board[e.kingFrom];
        const rook = before.board[e.rookFrom];
        if (king) motion.slides.set(king.id, { from: e.kingFrom, to: e.kingTo });
        if (rook) motion.slides.set(rook.id, { from: e.rookFrom, to: e.rookTo });
        break;
      }
      case "battle": {
        const attacker = byId.get(e.attackerId);
        const defender = byId.get(e.defenderId);
        const r = e.result;
        if (r.attackerMoves) {
          motion.slides.set(e.attackerId, { from: e.from, to: e.to });
          motion.impactDelay = SLIDE_MS;
        } else if (r.attackerRemoved && attacker) {
          motion.ghosts.push({ piece: attacker, square: e.to, slideFrom: e.from });
          motion.impactDelay = SLIDE_MS;
        } else {
          motion.lunges.set(e.attackerId, { from: e.from, toward: e.defenderSquare });
          motion.impactDelay = LUNGE_MS / 2;
        }
        if (r.defenderRemoved && defender) {
          motion.ghosts.push({ piece: defender, square: e.defenderSquare });
        }
        break;
      }
      default:
        break;
    }
  }
  return motion;
}
