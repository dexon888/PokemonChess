import type { Color, GameEvent, GameState } from "@pokemon-chess/engine";
import type { TimeControlId } from "./timeControls.js";

/**
 * What the server sends. These are plain JSON messages rather than Colyseus schema state: the
 * engine's GameState is already serializable, and every update carries the events that produced
 * it so clients can animate exactly what happened (ARCHITECTURE.md, data flow step 5).
 */

export interface PlayerInfo {
  nickname: string;
  color: Color;
  connected: boolean;
  /** While disconnected: server time (ms since epoch) when the reconnect grace ends (R12). */
  graceEndsAt: number | null;
}

/** Remaining time per side, measured at server time `at`. Clients count down from there. */
export interface ClockState {
  white: number;
  black: number;
  /** Whose clock is running, or null when the match is not in progress. */
  running: Color | null;
  at: number;
}

export interface MatchSnapshot {
  matchId: string;
  state: GameState;
  players: PlayerInfo[];
  /** The receiving player's colour; null for anyone else. */
  you: Color | null;
  timeControl: TimeControlId;
  clocks: ClockState | null;
  drawOfferFrom: Color | null;
  rematchRequestedBy: Color[];
  /** Number of actions applied so far; increases by one per `events` message. */
  seq: number;
  /** Server time (ms since epoch) when this snapshot was made, for countdowns such as grace. */
  serverTime: number;
}

/** One applied action: its events (every roll included) and the snapshot after it. */
export interface MatchEventsMessage {
  seq: number;
  events: GameEvent[];
  snapshot: MatchSnapshot;
}

export type ErrorCode =
  | "invalidMessage"
  | "illegalAction"
  | "notYourTurn"
  | "notAPlayer"
  | "matchNotActive"
  | "cannotClaim";

export interface ErrorMessage {
  code: ErrorCode;
  message: string;
}

/** Server → client message types and their payloads. */
export interface ServerMessages {
  snapshot: MatchSnapshot;
  events: MatchEventsMessage;
  error: ErrorMessage;
}
export type ServerMessageType = keyof ServerMessages;
