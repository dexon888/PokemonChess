import { randomInt } from "node:crypto";
import { Room, ServerError, type Client } from "@colyseus/core";
import { createSeededRng } from "@pokemon-chess/engine";
import { joinOptionsSchema, parseClientMessage } from "@pokemon-chess/protocol";
import { z } from "zod";
import { Match, type Outbound } from "./match.js";

/**
 * Colyseus adapter around one authoritative Match. It validates every incoming message with the
 * protocol schemas, hands it to the Match, and delivers what the Match returns. No game logic
 * lives here, and no Colyseus schema state is used (D6).
 *
 * This step is untimed with no reconnection; clocks, reconnect grace and private codes are later
 * M4 steps.
 */
export class MatchRoom extends Room {
  override maxClients = 2;
  match!: Match;
  /** Kept so a match can be replayed from its log. */
  seed!: number;

  override onCreate() {
    this.seed = randomInt(2 ** 31);
    this.match = new Match({
      matchId: this.roomId,
      timeControl: "untimed",
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

  private deliver(out: Outbound[]) {
    for (const o of out) this.clients.get(o.to)?.send(o.type, o.payload);
  }
}
