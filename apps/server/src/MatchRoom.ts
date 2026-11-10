import { randomInt } from "node:crypto";
import { Room, ServerError, type Client } from "@colyseus/core";
import { createSeededRng } from "@pokemon-chess/engine";
import {
  createPrivateOptionsSchema,
  MATCHMAKING_TIME_CONTROL,
  parseClientMessage,
  TIME_CONTROL_IDS,
  type TimeControlId,
} from "@pokemon-chess/protocol";
import { z } from "zod";
import { Match, type Outbound } from "./match.js";

/** Room creation: an optional time control; defaults to the matchmaking 10+5 (R11). */
const createOptionsSchema = z.object({
  timeControl: z.enum(TIME_CONTROL_IDS as [TimeControlId, ...TimeControlId[]]).optional(),
});
/** Joining: a nickname, plus the creator's time control when they created the room. */
const joinOptionsSchema = createPrivateOptionsSchema.partial({ timeControl: true });

/**
 * Colyseus adapter around one authoritative Match. It validates every incoming message with the
 * protocol schemas, hands it to the Match, and delivers what the Match returns. No game logic
 * lives here, and no Colyseus schema state is used (D6).
 *
 * Clocks: after every delivery the room arms one timer for the moment the side to move would run
 * out of time; when it fires, Match decides whether the flag has fallen.
 */
export class MatchRoom extends Room {
  override maxClients = 2;
  match!: Match;
  /** Kept so a match can be replayed from its log. */
  seed!: number;
  private flagTimer: ReturnType<Room["clock"]["setTimeout"]> | null = null;

  override onCreate(options: unknown) {
    const opts = createOptionsSchema.safeParse(options ?? {});
    if (!opts.success) throw new ServerError(400, z.prettifyError(opts.error));

    this.seed = randomInt(2 ** 31);
    this.match = new Match({
      matchId: this.roomId,
      timeControl: opts.data.timeControl ?? MATCHMAKING_TIME_CONTROL,
      rng: createSeededRng(this.seed),
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
  }

  override onLeave(client: Client) {
    this.deliver(this.match.leave(client.sessionId));
  }

  override onDispose() {
    this.flagTimer?.clear();
  }

  private deliver(out: Outbound[]) {
    for (const o of out) this.clients.get(o.to)?.send(o.type, o.payload);
    this.armFlagTimer();
  }

  /** (Re)arms the single flag timer. A timer that fires early simply re-arms itself. */
  private armFlagTimer() {
    this.flagTimer?.clear();
    this.flagTimer = null;
    const ms = this.match.msUntilFlag();
    if (ms === null) return;
    this.flagTimer = this.clock.setTimeout(() => this.deliver(this.match.tick()), ms + 1);
  }
}
