import { matchMaker, Room, ServerError, type Client } from "@colyseus/core";
import {
  joinOptionsSchema,
  MATCHMAKING_TIME_CONTROL,
  type MatchFoundMessage,
  type QueueMessage,
} from "@pokemon-chess/protocol";
import { z } from "zod";

interface Waiting {
  client: Client;
  nickname: string;
  joinedAt: number;
}

/**
 * The matchmaking queue (PRD 5.1), room name `queue`. Everyone searching joins this one room
 * with `joinOrCreate("queue", { nickname })`. The two longest-waiting players are paired: the
 * queue creates an unlisted 10+5 match room for them (R11), reserves a seat for each, and sends
 * each a `matchFound` with their reservation. Colours and Pokémon are rolled in the match.
 * Leaving the room cancels the search.
 */
export class QueueRoom extends Room {
  override maxClients = 10_000;
  private readonly waiting: Waiting[] = [];
  /** Pairings run one at a time, so nobody is paired twice. */
  private pairing: Promise<void> = Promise.resolve();

  override onCreate() {
    this.onMessage("*", (client: Client) => {
      client.send("error", {
        code: "invalidMessage",
        message: "The queue takes no messages; leave the room to cancel",
      });
    });
  }

  override onJoin(client: Client, options: unknown) {
    const opts = joinOptionsSchema.safeParse(options);
    if (!opts.success) throw new ServerError(400, z.prettifyError(opts.error));
    this.waiting.push({ client, nickname: opts.data.nickname, joinedAt: Date.now() });
    this.sendStatus();
    this.pairing = this.pairing.then(() => this.pairAll());
  }

  /** Cancelling is leaving. */
  override onLeave(client: Client) {
    const i = this.waiting.findIndex((w) => w.client.sessionId === client.sessionId);
    if (i >= 0) this.waiting.splice(i, 1);
    this.sendStatus();
  }

  private async pairAll() {
    if (this.waiting.length < 2) return;
    while (this.waiting.length >= 2) {
      const [a, b] = this.waiting.splice(0, 2) as [Waiting, Waiting];
      try {
        const room = await matchMaker.createRoom("match", {
          timeControl: MATCHMAKING_TIME_CONTROL,
          matchmade: true,
        });
        const [seatA, seatB] = await Promise.all([
          matchMaker.reserveSeatFor(room, { nickname: a.nickname }),
          matchMaker.reserveSeatFor(room, { nickname: b.nickname }),
        ]);
        const found = (reservation: unknown, opponent: Waiting): MatchFoundMessage => ({
          reservation,
          timeControl: MATCHMAKING_TIME_CONTROL,
          opponent: { nickname: opponent.nickname },
        });
        // If either has left meanwhile, the other reaches the room alone and the match room
        // cancels itself after its no-show timeout, telling them to search again.
        a.client.send("matchFound", found(seatA, b));
        b.client.send("matchFound", found(seatB, a));
      } catch (err) {
        // Could not set up the match: put both back at the front of the queue and retry later.
        console.error("Matchmaking failed", err);
        this.waiting.unshift(...[a, b].filter((w) => this.clients.get(w.client.sessionId)));
        break;
      }
    }
    this.sendStatus();
  }

  /** Each searching player gets the queue size and their own start time (PRD 6.5). */
  private sendStatus() {
    const now = Date.now();
    for (const w of this.waiting) {
      const status: QueueMessage = {
        timeControl: MATCHMAKING_TIME_CONTROL,
        searching: this.waiting.length,
        joinedAt: w.joinedAt,
        serverTime: now,
      };
      w.client.send("queue", status);
    }
  }
}
