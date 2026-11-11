import { defineRoom } from "@colyseus/core";
import config from "@colyseus/tools";
import { MatchRoom } from "./MatchRoom.js";
import { PrivateMatchRoom } from "./PrivateMatchRoom.js";

const isDev = process.env.NODE_ENV !== "production";

export default config({
  rooms: {
    match: defineRoom(MatchRoom),
    private: defineRoom(PrivateMatchRoom),
  },
  initializeExpress: async (app) => {
    app.get("/health", (_req, res) => {
      res.json({ ok: true });
    });
    if (isDev) {
      // Dev only: a page for joining rooms and sending messages by hand (see apps/server/README).
      const { playground } = await import("@colyseus/playground");
      app.use("/playground", playground());
    }
  },
});
