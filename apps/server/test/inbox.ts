import type { ColyseusTestServer } from "@colyseus/testing";
import type { ServerMessages } from "@pokemon-chess/protocol";

export type SdkRoom = Awaited<ReturnType<ColyseusTestServer["connectTo"]>>;

/** Anything that delivers all messages to one "*" handler (any SDK room, whatever its type). */
interface MessageSource {
  onMessage(type: "*", cb: (type: string | number, payload: unknown) => void): unknown;
}

/** Collects every message a client receives, by type, and lets a test await the next one. */
export function inbox(room: MessageSource) {
  const seen: { type: string; payload: unknown }[] = [];
  const waiters: { type: string; resolve: (p: unknown) => void }[] = [];
  room.onMessage("*", (type: string | number, payload: unknown) => {
    const w = waiters.findIndex((x) => x.type === type);
    if (w >= 0) waiters.splice(w, 1)[0]?.resolve(payload);
    else seen.push({ type: String(type), payload });
  });
  return {
    next<K extends keyof ServerMessages>(type: K, timeoutMs = 2000): Promise<ServerMessages[K]> {
      const i = seen.findIndex((m) => m.type === type);
      if (i >= 0) return Promise.resolve(seen.splice(i, 1)[0]?.payload as ServerMessages[K]);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`No "${type}" within ${timeoutMs}ms`)),
          timeoutMs,
        );
        waiters.push({
          type,
          resolve: (p) => {
            clearTimeout(timer);
            resolve(p as ServerMessages[K]);
          },
        });
      });
    },
  };
}
