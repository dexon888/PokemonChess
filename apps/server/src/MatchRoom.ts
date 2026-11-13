import { randomInt } from "node:crypto";
import { Room, ServerError, type Client } from "@colyseus/core";
import { createSeededRng } from "@pokemon-chess/engine";
import {
  createPrivateOptionsSchema,
  MATCHMAKING_TIME_CONTROL,
  parseClientMessage,
  TIME_CONTROL_IDS,
  type ErrorCode,
  type TimeControlId,
} from "@pokemon-chess/protocol";
import { z } from "zod";
import { Match, type Outbound } from "./match.js";

/**
 * Room creation: an optional time control (default: the matchmaking 10+5, R11). `matchmade`
 * marks a room the queue created for two paired players: it is unlisted, and it cancels itself
 * if both never arrive.
 */
const createOptionsSchema = z.object({
  timeControl: z.enum(TIME_CONTROL_IDS as [TimeControlId, ...TimeControlId[]]).optional(),
  matchmade: z.boolean().optional(),
});
/** Joining: a nickname, plus the creator's time control when they created the room. */
const joinOptionsSchema = createPrivateOptionsSchema.partial({ timeControl: true });

/**
 * Colyseus adapter around one authoritative Match. It validates every incoming message with the
 * protocol schemas, hands it to the Match, and delivers what the Match returns. No game logic
 * lives here, and no Colyseus schema state is used (D6).
 *
 * Time: after every delivery the room arms one timer for the next time-based event (a flag
 * falling, or a reconnect grace ending); when it fires, Match decides what happened.
 *
 * Reconnection (R12, R13): a dropped player's seat is held with Colyseus's reconnection token for
 * as long as the match needs it ("manual"), not just the 60-second grace, because after the grace
 * the opponent may choose to keep waiting. The room closes once nobody can come back.
 */
export class MatchRoom extends Room {
  /** How long a matchmade room waits for both paired players. Tests shorten it. */
  static noShowTimeoutMs = 20_000;
  override maxClients = 2;
  match!: Match;
  /** Kept so a match can be replayed from its log. */
  seed!: number;
  private wakeTimer: ReturnType<Room["clock"]["setTimeout"]> | null = null;
  private expiryTimer: ReturnType<Room["clock"]["setTimeout"]> | null = null;
  private closing = false;

  override async onCreate(options: unknown) {
    const opts = createOptionsSchema.safeParse(options ?? {});
    if (!opts.success) throw new ServerError(400, z.prettifyError(opts.error));
    this.setUp(opts.data.timeControl ?? MATCHMAKING_TIME_CONTROL, false);
    if (opts.data.matchmade) {
      await this.setPrivate(true);
      // A paired player's seat stays reserved exactly as long as the no-show window, so an
      // unused reservation never keeps the room alive past it.
      this.seatReservationTimeout = Math.max(1, Math.ceil(MatchRoom.noShowTimeoutMs / 1000));
      this.expireUnstartedAfter(
        MatchRoom.noShowTimeoutMs,
        "matchCancelled",
        "Your opponent did not arrive; search again",
      );
    }
  }

  /**
   * Closes the room if the match has not started within `ms`, first telling anyone waiting why.
   * Used for unused private invites and for matchmade opponents who never arrive.
   */
  protected expireUnstartedAfter(ms: number, code: ErrorCode, message: string) {
    this.match.lobbyExpiresAt = this.match.now() + ms;
    this.expiryTimer = this.clock.setTimeout(() => {
      if (this.match.started) return;
      for (const c of this.clients) c.send("error", { code, message });
      this.close();
    }, ms);
  }

  /** Creates the Match (after the room ID is final) and routes every client message to it. */
  protected setUp(timeControl: TimeControlId, isPrivate: boolean) {
    this.seed = randomInt(2 ** 31);
    this.match = new Match({
      matchId: this.roomId,
      timeControl,
      rng: createSeededRng(this.seed),
      isPrivate,
    });

    this.onMessage("*", (client: Client, type: string | number, payload: unknown) => {
      const parsed = parseClientMessage(type, payload);
      if (!parsed.ok) {
        client.send("error", { code: "invalidMessage", message: parsed.error });
        return;
      }
      this.deliver(this.match.handle(client.sessionId, parsed.message));
    });
  }

  override onJoin(client: Client, options: unknown) {
    const opts = joinOptionsSchema.safeParse(options);
    if (!opts.success) throw new ServerError(400, z.prettifyError(opts.error));
    this.deliver(this.match.join(client.sessionId, opts.data.nickname));
    if (this.match.started && this.expiryTimer) {
      this.expiryTimer.clear();
      this.expiryTimer = null;
      this.match.lobbyExpiresAt = null;
    }
  }

  /** Connection lost without the player choosing to leave: hold their seat (R12). */
  override onDrop(client: Client) {
    // Before the match starts, or while the room is closing, there is nothing to hold;
    // Colyseus then calls onLeave.
    if (!this.match.started || this.closing) return;
    // Colyseus settles this promise itself (onReconnect, or onLeave when rejected); the catch
    // only keeps a rejection during disposal from surfacing as unhandled.
    this.allowReconnection(client, "manual").catch(() => {});
    this.deliver(this.match.disconnect(client.sessionId));
  }

  override onBeforeShutdown() {
    // Server shutdown drops every client; don't hold seats in a room that is going away.
    this.closing = true;
    super.onBeforeShutdown();
  }

  /** The player is back with their reconnection token (R13): same session, latest state. */
  override onReconnect(client: Client) {
    this.deliver(this.match.reconnect(client.sessionId));
  }

  /** Gone for good: a deliberate leave, or a held seat the room gave up on when closing. */
  override onLeave(client: Client) {
    this.deliver(this.match.leave(client.sessionId));
  }

  override onDispose() {
    this.wakeTimer?.clear();
    this.expiryTimer?.clear();
  }

  protected deliver(out: Outbound[]) {
    for (const o of out) this.clients.get(o.to)?.send(o.type, o.payload);
    if (this.match.everyoneGone()) {
      this.close();
      return;
    }
    this.armWakeTimer();
  }

  /** (Re)arms the single wake timer. A timer that fires early simply re-arms itself. */
  private armWakeTimer() {
    this.wakeTimer?.clear();
    this.wakeTimer = null;
    const ms = this.match.msUntilWake();
    if (ms === null) return;
    this.wakeTimer = this.clock.setTimeout(() => this.deliver(this.match.tick()), ms + 1);
  }

  /** Nobody can come back: release held seats and dispose of the room. */
  protected close() {
    if (this.closing) return;
    this.closing = true;
    this.wakeTimer?.clear();
    void this.disconnect();
  }
}
