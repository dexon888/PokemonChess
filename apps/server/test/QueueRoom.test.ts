import { matchMaker } from "@colyseus/core";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import type { MatchFoundMessage } from "@pokemon-chess/protocol";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import appConfig from "../src/app.config.js";
import { MatchRoom } from "../src/MatchRoom.js";
import { inbox } from "./inbox.js";

/** Matchmaking (PRD 5.1) end to end, the way the web client will use it. */

let colyseus: ColyseusTestServer;
beforeAll(async () => {
  colyseus = await boot(appConfig);
});
afterAll(async () => {
  await colyseus.shutdown();
});
const defaultNoShow = MatchRoom.noShowTimeoutMs;
beforeEach(async () => {
  await colyseus.cleanup();
  // Several tests pair players who never enter their match; a short no-show window (and with
  // it, short seat reservations) lets those rooms close before the next test's cleanup.
  MatchRoom.noShowTimeoutMs = 1000;
});
afterEach(() => {
  MatchRoom.noShowTimeoutMs = defaultNoShow;
});

async function search(nickname: string) {
  const room = await colyseus.sdk.joinOrCreate("queue", { nickname });
  return { room, in: inbox(room) };
}

/** Enter the match the queue found, as the client will: consume the seat, leave the queue. */
async function enter(found: MatchFoundMessage, queue: Awaited<ReturnType<typeof search>>) {
  const match = await colyseus.sdk.consumeSeatReservation(found.reservation as never);
  const mIn = inbox(match);
  await queue.room.leave();
  return { match, in: mIn };
}

describe("matchmaking queue", () => {
  it("shows a lone searcher the queue status", async () => {
    const before = Date.now();
    const a = await search("Ash");
    const status = await a.in.next("queue");
    expect(status).toMatchObject({ timeControl: "10+5", searching: 1 });
    expect(status.joinedAt).toBeGreaterThanOrEqual(before);
  });

  it("pairs two searchers into a 10+5 match with random colours", async () => {
    const a = await search("Ash");
    const b = await search("Gary");
    const [fa, fb] = await Promise.all([a.in.next("matchFound"), b.in.next("matchFound")]);
    expect(fa.opponent.nickname).toBe("Gary");
    expect(fb.opponent.nickname).toBe("Ash");
    expect(fa.timeControl).toBe("10+5");

    const [ma, mb] = await Promise.all([enter(fa, a), enter(fb, b)]);
    expect(ma.match.roomId).toBe(mb.match.roomId);
    const [sa, sb] = await Promise.all([ma.in.next("snapshot"), mb.in.next("snapshot")]);
    expect([sa.you, sb.you].sort()).toEqual(["black", "white"]);
    expect(sa.timeControl).toBe("10+5");
    expect(sa.clocks?.running).toBe("white");
  });

  it("creates an unlisted match that strangers cannot join", async () => {
    const a = await search("Ash");
    const b = await search("Gary");
    const fa = await a.in.next("matchFound");
    await b.in.next("matchFound");
    const ma = await enter(fa, a);
    const stranger = await colyseus.sdk.joinOrCreate("match", { nickname: "Misty" });
    expect(stranger.roomId).not.toBe(ma.match.roomId);
  });

  it("cancelling (leaving the queue) means you are never paired", async () => {
    const a = await search("Ash");
    await a.in.next("queue");
    await a.room.leave();
    const b = await search("Gary");
    expect((await b.in.next("queue")).searching).toBe(1);
    await expect(b.in.next("matchFound", 300)).rejects.toThrow();

    const c = await search("Brock");
    expect((await c.in.next("matchFound")).opponent.nickname).toBe("Gary");
  });

  it("pairs in arrival order and leaves an odd player searching", async () => {
    const a = await search("Ash");
    const b = await search("Gary");
    const c = await search("Brock");
    expect((await a.in.next("matchFound")).opponent.nickname).toBe("Gary");
    await b.in.next("matchFound");
    await expect(c.in.next("matchFound", 300)).rejects.toThrow();
    const statuses = [];
    // Brock's latest status shows only himself searching.
    for (;;) {
      const s = await c.in.next("queue", 300).catch(() => null);
      if (!s) break;
      statuses.push(s);
    }
    expect(statuses.at(-1)?.searching).toBe(1);
  });

  it("cancels the match if the paired opponent never arrives", async () => {
    MatchRoom.noShowTimeoutMs = 300;
    const a = await search("Ash");
    const b = await search("Gary");
    const fa = await a.in.next("matchFound");
    await b.in.next("matchFound");
    await b.room.leave(); // Gary walks away instead of entering
    const ma = await enter(fa, a);
    const left = new Promise((resolve) => ma.match.onLeave(resolve));
    expect((await ma.in.next("error", 2000)).code).toBe("matchCancelled");
    await left; // Ash is sent back (the client then searches again)
    // The room is out of matchmaking at once; it is disposed when Gary's reservation lapses.
    expect(await matchMaker.getRoomById(ma.match.roomId)).toBeUndefined();
  });

  it("refuses a search without a valid nickname, and takes no messages", async () => {
    await expect(colyseus.sdk.joinOrCreate("queue", { nickname: "" })).rejects.toThrow();
    const a = await search("Ash");
    a.room.send("move", { from: 12, to: 28 });
    expect((await a.in.next("error")).code).toBe("invalidMessage");
  });
});
