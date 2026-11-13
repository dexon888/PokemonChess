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
  | "cannotClaim"
  | "roomExpired"
  /** A matchmade opponent never arrived; search again. */
  | "matchCancelled";

export interface ErrorMessage {
  code: ErrorCode;
  message: string;
}

/** Server → client message types and their payloads. */
/**
 * Before the match starts (PRD 6.6): who is in the room while it waits for an opponent. Sent to
 * everyone in the room on every change; the first `snapshot` means the match has started.
 */
export interface LobbyMessage {
  /** The room ID. For a private room this is the invite code. */
  roomId: string;
  private: boolean;
  timeControl: TimeControlId;
  /** Players in join order; the first is the host. */
  players: { nickname: string }[];
  /** For a private room that nobody has joined yet: when it closes (server ms since epoch). */
  expiresAt: number | null;
  serverTime: number;
}

/** Matchmaking queue status (PRD 6.5), sent to everyone searching whenever it changes. */
export interface QueueMessage {
  timeControl: TimeControlId;
  /** Players currently searching, you included. */
  searching: number;
  /** When you started searching (server ms since epoch), for an elapsed-time display. */
  joinedAt: number;
  serverTime: number;
}

/**
 * Matchmaking paired you (PRD 5.1). Pass `reservation` to `client.consumeSeatReservation()` to
 * enter the match, then leave the queue room. Colours are assigned in the match.
 */
export interface MatchFoundMessage {
  /** Opaque Colyseus seat reservation; valid for a few seconds. */
  reservation: unknown;
  timeControl: TimeControlId;
  opponent: { nickname: string };
}

export interface ServerMessages {
  queue: QueueMessage;
  matchFound: MatchFoundMessage;
  lobby: LobbyMessage;
  snapshot: MatchSnapshot;
  events: MatchEventsMessage;
  error: ErrorMessage;
}
export type ServerMessageType = keyof ServerMessages;
