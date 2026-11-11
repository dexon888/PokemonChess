import { randomInt } from "node:crypto";
import { matchMaker, ServerError } from "@colyseus/core";
import { createPrivateOptionsSchema, makeRoomCode } from "@pokemon-chess/protocol";
import { z } from "zod";
import { MatchRoom } from "./MatchRoom.js";

/**
 * A private match joined by invite code (PRD 5.2). The host picks the time control (R11); the
 * room's ID is a short code, so the invite link is just `/join/CODE` and the guest calls
 * `client.joinById(CODE)`. The room is private, so `joinOrCreate` never puts a stranger in it,
 * and it locks at two players, so no third player can join. An unused room closes after
 * `waitingTimeoutMs`, which makes old invites expire (D7).
 */
export class PrivateMatchRoom extends MatchRoom {
  /** How long a room waits for the invited player before closing. Tests shorten it. */
  static waitingTimeoutMs = 30 * 60_000;

  override async onCreate(options: unknown) {
    const opts = createPrivateOptionsSchema.safeParse(options);
    if (!opts.success) throw new ServerError(400, z.prettifyError(opts.error));

    this.roomId = await uniqueRoomCode();
    await this.setPrivate(true);
    this.setUp(opts.data.timeControl, true);
    this.expireUnstartedAfter(
      PrivateMatchRoom.waitingTimeoutMs,
      "roomExpired",
      "Nobody joined in time; this invite expired",
    );
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
