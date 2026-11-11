import { matchMaker } from "@colyseus/core";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { ROOM_CODE_LENGTH, roomCodeSchema } from "@pokemon-chess/protocol";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import appConfig from "../src/app.config.js";
import { PrivateMatchRoom } from "../src/PrivateMatchRoom.js";
import { inbox } from "./inbox.js";

/** Private rooms (PRD 5.2) end to end, the way the web client will use them. */

let colyseus: ColyseusTestServer;
beforeAll(async () => {
  colyseus = await boot(appConfig);
});
afterAll(async () => {
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
});
const defaultTimeout = PrivateMatchRoom.waitingTimeoutMs;
afterEach(() => {
  PrivateMatchRoom.waitingTimeoutMs = defaultTimeout;
});

async function host(timeControl = "5+3") {
  const room = await colyseus.sdk.create("private", { nickname: "Ash", timeControl });
  return { room, in: inbox(room), code: room.roomId };
}

describe("private rooms", () => {
  it("get a short invite code as their ID and show the host a waiting lobby", async () => {
    const before = Date.now();
    const h = await host();
    expect(h.code).toHaveLength(ROOM_CODE_LENGTH);
    expect(roomCodeSchema.parse(h.code)).toBe(h.code);

    const lobby = await h.in.next("lobby");
    expect(lobby).toMatchObject({
      roomId: h.code,
      private: true,
      timeControl: "5+3",
      players: [{ nickname: "Ash" }],
    });
    expect(lobby.expiresAt).toBeGreaterThanOrEqual(before + 30 * 60_000);
  });

  it("start the match when the invited player joins by code, with the host's time control", async () => {
    const h = await host("30+0");
    const guest = await colyseus.sdk.joinById(h.code, { nickname: "Gary" });
    const gIn = inbox(guest);
    const [a, b] = await Promise.all([h.in.next("snapshot"), gIn.next("snapshot")]);
    expect([a.you, b.you].sort()).toEqual(["black", "white"]);
    expect(a.timeControl).toBe("30+0");
    expect(a.clocks?.running).toBe("white");
    expect(a.players.map((p) => p.nickname).sort()).toEqual(["Ash", "Gary"]);
  });

  it("refuse a third player", async () => {
    const h = await host();
    await colyseus.sdk.joinById(h.code, { nickname: "Gary" });
    await expect(colyseus.sdk.joinById(h.code, { nickname: "Brock" })).rejects.toThrow();
  });

  it("are never used by joinOrCreate, so strangers cannot land in them", async () => {
    const h = await host();
    const stranger = await colyseus.sdk.joinOrCreate("match", { nickname: "Misty" });
    expect(stranger.roomId).not.toBe(h.code);
    const priv = await colyseus.sdk.joinOrCreate("private", {
      nickname: "Misty",
      timeControl: "5+3",
    });
    expect(priv.roomId).not.toBe(h.code);
  });

  it("reject an unknown code", async () => {
    await expect(colyseus.sdk.joinById("ZZZZZZ", { nickname: "Gary" })).rejects.toThrow();
  });

  it("need a nickname and one of the R11 time controls", async () => {
    await expect(colyseus.sdk.create("private", { nickname: "Ash" })).rejects.toThrow();
    await expect(
      colyseus.sdk.create("private", { nickname: "Ash", timeControl: "1+0" }),
    ).rejects.toThrow();
    await expect(
      colyseus.sdk.create("private", { nickname: " ", timeControl: "5+3" }),
    ).rejects.toThrow();
  });

  it("close when the host leaves before anyone joins, so the invite stops working", async () => {
    const h = await host();
    await h.room.leave();
    await new Promise((r) => setTimeout(r, 100));
    expect(matchMaker.getLocalRoomById(h.code)).toBeUndefined();
    await expect(colyseus.sdk.joinById(h.code, { nickname: "Gary" })).rejects.toThrow();
  });

  it("expire unused, telling the host why", async () => {
    PrivateMatchRoom.waitingTimeoutMs = 200;
    const h = await host();
    expect((await h.in.next("error", 2000)).code).toBe("roomExpired");
    await new Promise((r) => setTimeout(r, 100));
    expect(matchMaker.getLocalRoomById(h.code)).toBeUndefined();
  });

  it("do not expire once the match has started", async () => {
    PrivateMatchRoom.waitingTimeoutMs = 200;
    const h = await host();
    await colyseus.sdk.joinById(h.code, { nickname: "Gary" });
    await h.in.next("snapshot");
    await new Promise((r) => setTimeout(r, 400));
    expect(matchMaker.getLocalRoomById(h.code)).toBeDefined();
  });
});
