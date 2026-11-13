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
  RECONNECT_GRACE_MS,
  TIME_CONTROLS,
  type ClientMessage,
  type ErrorCode,
  type MatchSnapshot,
  type MatchStats,
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
  /** While disconnected in an active match: when the reconnect grace ends (R12). */
  graceEndsAt: number | null;
  /** Whether both players have been told this seat's grace ran out. */
  graceAnnounced: boolean;
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
  /** A private room joined by code (PRD 5.2); shown in the lobby. */
  isPrivate?: boolean;
}

/**
 * One authoritative match, independent of the network layer. The room feeds it joins, leaves
 * and validated client messages; it returns the messages to deliver. Nothing here re-rolls:
 * each random outcome is produced once by `rng` and recorded in `log`.
 */
export class Match {
  readonly matchId: string;
  readonly timeControl: TimeControlId;
  readonly isPrivate: boolean;
  /** Set by a private room while it waits for an opponent: when it will close unused. */
  lobbyExpiresAt: number | null = null;
  readonly log: LogRecord[] = [];
  private readonly rng: Rng;
  private readonly setup: MatchOptions["setup"];
  /** Current time in ms. Public so tests can move time forward. */
  now: () => number;
  private readonly seats: Seat[] = [];
  private clock: ChessClock | null;
  /** Which game in this room (1, then 2 after a rematch…). */
  private gameNumber = 1;
  /** Logs of earlier games in this room, oldest first; `log` is the current game. */
  readonly pastLogs: LogRecord[][] = [];
  private readonly rematchRequestedBy = new Set<Color>();
  private game: GameState | null = null;
  private drawOfferFrom: Color | null = null;

  constructor(opts: MatchOptions) {
    this.matchId = opts.matchId;
    this.timeControl = opts.timeControl;
    this.rng = opts.rng;
    this.setup = opts.setup;
    this.isPrivate = opts.isPrivate ?? false;
    this.now = opts.now ?? Date.now;

    this.clock = this.newClock();
  }

  /** Milliseconds until the side to move runs out of time; null when untimed or not running. */
  msUntilFlag(): number | null {
    return this.clock?.msUntilFlag(this.now()) ?? null;
  }

  /**
   * Milliseconds until something time-based happens (a flag falls or a reconnect grace ends),
   * or null when nothing is pending. The room arms one timer for this and then calls `tick()`.
   */
  msUntilWake(): number | null {
    const now = this.now();
    const waits = this.seats
      .filter((s) => s.graceEndsAt !== null && !s.graceAnnounced)
      .map((s) => Math.max(0, (s.graceEndsAt as number) - now));
    const flag = this.msUntilFlag();
    if (flag !== null) waits.push(flag);
    return waits.length ? Math.min(...waits) : null;
  }

  /**
   * Time-based updates: ends the match on time if the side to move has run out (R11), and tells
   * both players when a disconnected opponent's grace has run out, so a win can be claimed (R12).
   */
  tick(): Outbound[] {
    const now = this.now();
    const flagged = this.clock?.flagged(now);
    if (flagged && this.game?.status.state === "active") {
      return this.apply(null, flagged, { type: "timeout", color: flagged });
    }
    const expired = this.seats.filter(
      (s) => s.graceEndsAt !== null && !s.graceAnnounced && now >= s.graceEndsAt,
    );
    if (!expired.length) return [];
    for (const s of expired) s.graceAnnounced = true;
    return this.snapshots();
  }

  /**
   * True when nobody will come back: every player is disconnected, and either the match is over
   * or every grace has run out. The room then closes.
   */
  everyoneGone(): boolean {
    if (!this.seats.length || this.seats.some((s) => s.connected)) return false;
    if (this.game?.status.state !== "active") return true;
    const now = this.now();
    return this.seats.every((s) => s.graceEndsAt !== null && now >= s.graceEndsAt);
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
    this.seats.push({
      sessionId,
      nickname,
      color: null,
      connected: true,
      graceEndsAt: null,
      graceAnnounced: false,
    });
    return this.isFull ? this.start() : this.lobby();
  }

  /**
   * The player's connection dropped; they may come back with their reconnect token (R13). In an
   * active match the 60-second grace starts and their clock keeps running (R12).
   */
  disconnect(sessionId: string): Outbound[] {
    const seat = this.seat(sessionId);
    if (!seat) return [];
    if (!this.started) return this.leave(sessionId);
    seat.connected = false;
    seat.graceEndsAt = this.isActive ? this.now() + RECONNECT_GRACE_MS : null;
    seat.graceAnnounced = false;
    return this.snapshots();
  }

  /** The player came back. They get the latest authoritative state; nothing is re-rolled. */
  reconnect(sessionId: string): Outbound[] {
    const seat = this.seat(sessionId);
    if (!seat) return [];
    seat.connected = true;
    seat.graceEndsAt = null;
    seat.graceAnnounced = false;
    return this.snapshots();
  }

  /**
   * The player left for good (a deliberate leave, or a reconnection the room gave up on). Before
   * the match starts this frees the seat; during it, there is no grace to wait for, so the
   * opponent may claim victory straight away.
   */
  leave(sessionId: string): Outbound[] {
    const seat = this.seat(sessionId);
    if (!seat) return [];
    if (!this.started) {
      // Nobody has played yet: free the seat for someone else.
      this.seats.splice(this.seats.indexOf(seat), 1);
      return this.lobby();
    }
    seat.connected = false;
    seat.graceEndsAt = this.isActive ? this.now() : null;
    seat.graceAnnounced = true;
    return this.snapshots();
  }

  private get isActive(): boolean {
    return this.game?.status.state === "active";
  }

  handle(sessionId: string, msg: ClientMessage): Outbound[] {
    const seat = this.seat(sessionId);
    if (!seat?.color)
      return this.error(sessionId, "notAPlayer", "You are not playing in this match");
    const color = seat.color;
    // A message that arrives after the deadline loses the race: the flag falls first.
    const timedOut = this.tick();
    if (msg.type === "rematch") return [...timedOut, ...this.requestRematch(sessionId, color)];
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
      case "claimVictory": {
        // R12: only once the disconnected opponent's grace has run out.
        const opp = this.seats.find((s) => s.color === opponent(color));
        const now = this.now();
        if (!opp || opp.connected || opp.graceEndsAt === null || now < opp.graceEndsAt) {
          return this.error(
            sessionId,
            "cannotClaim",
            "You can claim victory only after your opponent's reconnect grace runs out",
          );
        }
        return this.apply(sessionId, color, { type: "abandon", color: opponent(color) });
      }
    }
  }

  /**
   * PRD 5.5: after a game, either player may ask for a rematch; the other sees the request. When
   * both have asked, the next game starts in the same room with colours swapped (R19), new
   * Pokémon and types, and fresh clocks. Nothing from the old game carries over.
   */
  private requestRematch(sessionId: string, color: Color): Outbound[] {
    if (!this.game || this.isActive) {
      return this.error(
        sessionId,
        "matchNotActive",
        "You can ask for a rematch once the game is over",
      );
    }
    this.rematchRequestedBy.add(color);
    if (this.rematchRequestedBy.size < 2) return this.snapshots();

    this.pastLogs.push(this.log.splice(0));
    this.gameNumber += 1;
    for (const s of this.seats) {
      if (s.color) s.color = opponent(s.color);
      s.graceEndsAt = null;
      s.graceAnnounced = false;
    }
    this.rematchRequestedBy.clear();
    this.drawOfferFrom = null;
    this.clock = this.newClock();
    const position = this.setup?.position ?? createRandomStartingPosition(ROSTER_V1, this.rng);
    this.game = newGame(position);
    this.clock?.start(this.game.turn, this.now());
    return this.snapshots();
  }

  private newClock(): ChessClock | null {
    const tc = TIME_CONTROLS[this.timeControl];
    return tc ? new ChessClock(tc.initialMs, tc.incrementMs) : null;
  }

  /** Captures, super-effective hits and crits by the attacker; dodges by the defender (PRD 6.7). */
  private stats(): Record<Color, MatchStats> {
    const s: Record<Color, MatchStats> = {
      white: { captures: 0, superEffective: 0, crits: 0, dodges: 0 },
      black: { captures: 0, superEffective: 0, crits: 0, dodges: 0 },
    };
    for (const record of this.log) {
      for (const e of record.events) {
        if (e.type !== "battle") continue;
        const r = e.result;
        if (r.outcome === "dodged") s[opponent(e.color)].dodges++;
        if (r.defenderRemoved) s[e.color].captures++;
        if (r.outcome === "superEffective") s[e.color].superEffective++;
        if (r.crit) s[e.color].crits++;
      }
    }
    return s;
  }

  /** The snapshot as seen by one session (or by an observer when `sessionId` is unknown). */
  snapshotFor(sessionId: string): MatchSnapshot {
    if (!this.game) throw new Error("Match has not started");
    return {
      matchId: this.matchId,
      game: this.gameNumber,
      state: this.game,
      stats: this.stats(),
      players: this.seats
        .filter((s): s is Seat & { color: Color } => s.color !== null)
        .map((s) => ({
          nickname: s.nickname,
          color: s.color,
          connected: s.connected,
          graceEndsAt: s.graceEndsAt,
        })),
      you: this.seat(sessionId)?.color ?? null,
      timeControl: this.timeControl,
      clocks: this.clock?.state(this.now()) ?? null,
      drawOfferFrom: this.drawOfferFrom,
      rematchRequestedBy: [...this.rematchRequestedBy],
      seq: this.log.length,
      serverTime: this.now(),
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
    if (this.game.status.state !== "active") {
      this.clock?.stop(now);
      // Nothing left to claim: a pending grace no longer matters.
      for (const s of this.seats) s.graceEndsAt = null;
    } else if (action.type === "move") this.clock?.press(by, this.game.turn, now);
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

  /** Waiting-room update for everyone seated, until the match starts (PRD 6.6). */
  private lobby(): Outbound[] {
    if (this.started) return [];
    const payload = {
      roomId: this.matchId,
      private: this.isPrivate,
      timeControl: this.timeControl,
      players: this.seats.map((s) => ({ nickname: s.nickname })),
      expiresAt: this.lobbyExpiresAt,
      serverTime: this.now(),
    };
    return this.seats.map((s) => ({ to: s.sessionId, type: "lobby" as const, payload }));
  }

  private error(sessionId: string, code: ErrorCode, message: string): Outbound[] {
    return [{ to: sessionId, type: "error", payload: { code, message } }];
  }

  private seat(sessionId: string): Seat | undefined {
    return this.seats.find((s) => s.sessionId === sessionId);
  }
}
