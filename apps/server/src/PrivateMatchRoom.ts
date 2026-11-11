import { randomInt } from "node:crypto";
import { matchMaker, ServerError, type Client } from "@colyseus/core";
import { createPrivateOptionsSchema, makeRoomCode } from "@pokemon-chess/protocol";
import { z } from "zod";
import { MatchRoom } from "./MatchRoom.js";

/**
 * A private match joined by invite code (PRD 5.2). The host picks the time control (R11); the
 * room's ID is a short code, so the invite link is just `/join/CODE` and the guest calls
 * `client.joinById(CODE)`. The room is private, so `joinOrCreate` never puts a stranger in it,
 * and it locks at two players, so no third player can join. An unused room closes after
 * `waitingTimeoutMs`, which makes old invites expire.
 */
export class PrivateMatchRoom extends MatchRoom {
  /** How long a room waits for the invited player before closing. Tests shorten it. */
  static waitingTimeoutMs = 30 * 60_000;
  private expiryTimer: ReturnType<MatchRoom["clock"]["setTimeout"]> | null = null;

  override async onCreate(options: unknown) {
    const opts = createPrivateOptionsSchema.safeParse(options);
    if (!opts.success) throw new ServerError(400, z.prettifyError(opts.error));

    this.roomId = await uniqueRoomCode();
    await this.setPrivate(true);
    this.setUp(opts.data.timeControl, true);

    const ms = PrivateMatchRoom.waitingTimeoutMs;
    this.match.lobbyExpiresAt = this.match.now() + ms;
    this.expiryTimer = this.clock.setTimeout(() => this.expireIfUnused(), ms);
  }

  override onJoin(client: Client, options: unknown) {
    super.onJoin(client, options);
    if (this.match.started) {
      this.expiryTimer?.clear();
      this.match.lobbyExpiresAt = null;
    }
  }

  override onDispose() {
    this.expiryTimer?.clear();
    super.onDispose();
  }

  private expireIfUnused() {
    if (this.match.started) return;
    for (const c of this.clients) {
      c.send("error", {
        code: "roomExpired",
        message: "Nobody joined in time; this invite expired",
      });
    }
    this.close();
  }
}

/** A code no live room is using. Collisions are rare (31^6 codes); retry a few times anyway. */
async function uniqueRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = makeRoomCode(randomInt);
    if (!(await matchMaker.getRoomById(code))) return code;
  }
  throw new ServerError(503, "Could not allocate a room code; try again");
}
