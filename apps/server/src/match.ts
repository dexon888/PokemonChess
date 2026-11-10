import {
  applyAction,
  createRandomStartingPosition,
  IllegalActionError,
  newGame,
  opponent,
  type Action,
  type Color,
  type GameEvent,
  type GameState,
  type Position,
  type Rng,
} from "@pokemon-chess/engine";
import {
  TIME_CONTROLS,
  type ClientMessage,
  type ErrorCode,
  type MatchSnapshot,
  type ServerMessages,
  type TimeControlId,
} from "@pokemon-chess/protocol";
import { ROSTER_V1 } from "@pokemon-chess/roster";
import { ChessClock } from "./clock.js";

/** A message for one session. Snapshots differ per player (`you`), so nothing is broadcast. */
export type Outbound = {
  [K in keyof ServerMessages]: { to: string; type: K; payload: ServerMessages[K] };
}[keyof ServerMessages];

interface Seat {
  sessionId: string;
  nickname: string;
  color: Color | null;
  connected: boolean;
}

/** One applied action in the match log. Battle events carry every roll, so the log is a replay. */
export interface LogRecord {
  seq: number;
  at: number;
  by: Color;
  action: Action;
  events: GameEvent[];
}

export interface MatchOptions {
  matchId: string;
  timeControl: TimeControlId;
  /** The match's only source of randomness: colours, Pokémon assignment and every battle. */
  rng: Rng;
  /** Tests: a fixed starting position and who gets White, instead of rolling them. */
  setup?: { position: Position; firstJoinerColor: Color };
  now?: () => number;
}

/**
 * One authoritative match, independent of the network layer. The room feeds it joins, leaves
 * and validated client messages; it returns the messages to deliver. Nothing here re-rolls:
 * each random outcome is produced once by `rng` and recorded in `log`.
 */
export class Match {
  readonly matchId: string;
  readonly timeControl: TimeControlId;
  readonly log: LogRecord[] = [];
  private readonly rng: Rng;
  private readonly setup: MatchOptions["setup"];
  /** Current time in ms. Public so tests can move time forward. */
  now: () => number;
  private readonly seats: Seat[] = [];
  private readonly clock: ChessClock | null;
  private game: GameState | null = null;
  private drawOfferFrom: Color | null = null;

  constructor(opts: MatchOptions) {
    this.matchId = opts.matchId;
    this.timeControl = opts.timeControl;
    this.rng = opts.rng;
    this.setup = opts.setup;
    this.now = opts.now ?? Date.now;
    const tc = TIME_CONTROLS[opts.timeControl];
    this.clock = tc ? new ChessClock(tc.initialMs, tc.incrementMs) : null;
  }

  /** Milliseconds until the side to move runs out of time; null when untimed or not running. */
  msUntilFlag(): number | null {
    return this.clock?.msUntilFlag(this.now()) ?? null;
  }

  /** Ends the match on time if the side to move has run out (R11). The room calls this on a timer. */
  tick(): Outbound[] {
    const flagged = this.clock?.flagged(this.now());
    if (!flagged || this.game?.status.state !== "active") return [];
    return this.apply(null, flagged, { type: "timeout", color: flagged });
  }

  get started(): boolean {
    return this.game !== null;
  }

  get state(): GameState | null {
    return this.game;
  }

  get isFull(): boolean {
    return this.seats.length >= 2;
  }

  join(sessionId: string, nickname: string): Outbound[] {
    if (this.isFull) throw new Error("Match is full");
    this.seats.push({ sessionId, nickname, color: null, connected: true });
    return this.isFull ? this.start() : [];
  }

  leave(sessionId: string): Outbound[] {
    const seat = this.seat(sessionId);
    if (!seat) return [];
    if (!this.started) {
      // Nobody has played yet: free the seat for someone else.
      this.seats.splice(this.seats.indexOf(seat), 1);
      return [];
    }
    seat.connected = false;
    return this.snapshots();
  }

  handle(sessionId: string, msg: ClientMessage): Outbound[] {
    const seat = this.seat(sessionId);
    if (!seat?.color)
      return this.error(sessionId, "notAPlayer", "You are not playing in this match");
    const color = seat.color;
    // A message that arrives after the deadline loses the race: the flag falls first.
    const timedOut = this.tick();
    const game = this.game;
    if (!game || game.status.state !== "active") {
      return [
        ...timedOut,
        ...this.error(sessionId, "matchNotActive", "The match is not in progress"),
      ];
    }

    switch (msg.type) {
      case "move": {
        if (game.turn !== color) return this.error(sessionId, "notYourTurn", "It is not your turn");
        const { from, to, promotion } = msg.payload;
        return this.apply(sessionId, color, {
          type: "move",
          from,
          to,
          ...(promotion ? { promotion } : {}),
        });
      }
      case "resign":
        // Allowed at any time, including during the opponent's turn or a bonus turn.
        return this.apply(sessionId, color, { type: "resign", color });
      case "offerDraw":
        if (this.drawOfferFrom === opponent(color)) {
          return this.apply(sessionId, color, { type: "agreeDraw" });
        }
        this.drawOfferFrom = color;
        return this.snapshots();
      case "answerDraw":
        if (this.drawOfferFrom !== opponent(color)) {
          return this.error(sessionId, "illegalAction", "There is no draw offer to answer");
        }
        if (msg.payload.accept) return this.apply(sessionId, color, { type: "agreeDraw" });
        this.drawOfferFrom = null;
        return this.snapshots();
      case "claimVictory":
        return this.error(sessionId, "cannotClaim", "Nothing to claim");
      case "rematch":
        return this.error(sessionId, "matchNotActive", "Rematches are only possible after a match");
    }
  }

  /** The snapshot as seen by one session (or by an observer when `sessionId` is unknown). */
  snapshotFor(sessionId: string): MatchSnapshot {
    if (!this.game) throw new Error("Match has not started");
    return {
      matchId: this.matchId,
      state: this.game,
      players: this.seats
        .filter((s): s is Seat & { color: Color } => s.color !== null)
        .map((s) => ({
          nickname: s.nickname,
          color: s.color,
          connected: s.connected,
          graceEndsAt: null,
        })),
      you: this.seat(sessionId)?.color ?? null,
      timeControl: this.timeControl,
      clocks: this.clock?.state(this.now()) ?? null,
      drawOfferFrom: this.drawOfferFrom,
      rematchRequestedBy: [],
      seq: this.log.length,
    };
  }

  private start(): Outbound[] {
    const [first, second] = this.seats as [Seat, Seat];
    const firstColor = this.setup?.firstJoinerColor ?? (this.rng.next() < 0.5 ? "white" : "black");
    first.color = firstColor;
    second.color = opponent(firstColor);
    const position = this.setup?.position ?? createRandomStartingPosition(ROSTER_V1, this.rng);
    this.game = newGame(position);
    // White's clock runs from the moment both players are seated.
    this.clock?.start(this.game.turn, this.now());
    return this.snapshots();
  }

  /** Applies one engine action. `sessionId` is null for server-initiated actions (timeouts). */
  private apply(sessionId: string | null, by: Color, action: Action): Outbound[] {
    if (!this.game) return [];
    let result;
    try {
      result = applyAction(this.game, action, this.rng);
    } catch (err) {
      if (err instanceof IllegalActionError && sessionId !== null) {
        return this.error(sessionId, "illegalAction", err.message);
      }
      throw err;
    }
    this.game = result.state;
    const now = this.now();
    if (this.game.status.state !== "active") this.clock?.stop(now);
    else if (action.type === "move") this.clock?.press(by, this.game.turn, now);
    // Any action ends a pending draw offer; agreeing to it is itself an action.
    this.drawOfferFrom = null;
    const seq = this.log.length + 1;
    this.log.push({ seq, at: this.now(), by, action, events: result.events });
    return this.seats.map((s) => ({
      to: s.sessionId,
      type: "events" as const,
      payload: { seq, events: result.events, snapshot: this.snapshotFor(s.sessionId) },
    }));
  }

  private snapshots(): Outbound[] {
    if (!this.game) return [];
    return this.seats.map((s) => ({
      to: s.sessionId,
      type: "snapshot" as const,
      payload: this.snapshotFor(s.sessionId),
    }));
  }

  private error(sessionId: string, code: ErrorCode, message: string): Outbound[] {
    return [{ to: sessionId, type: "error", payload: { code, message } }];
  }

  private seat(sessionId: string): Seat | undefined {
    return this.seats.find((s) => s.sessionId === sessionId);
  }
}
