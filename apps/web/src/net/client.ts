import { Client } from "@colyseus/sdk";

/**
 * The game server's address. Set VITE_SERVER_URL for a deployed server; in development it is
 * port 2567 on whatever host served this page, so another device on the same network (a phone
 * opening http://<your-pc>:5173) reaches the same server.
 */
export const SERVER_URL: string =
  import.meta.env.VITE_SERVER_URL ??
  `${window.location.protocol}//${window.location.hostname}:2567`;

let client: Client | null = null;

export function gameClient(): Client {
  client ??= new Client(SERVER_URL);
  return client;
}

/** The invite link for a private room code, on this site. */
export const inviteLink = (code: string) => `${window.location.origin}/join/${code}`;

const NICK_KEY = "pc.nickname";

/** The last nickname used on this device (a per-viewer convenience; may be unavailable). */
export function savedNickname(): string {
  try {
    return window.localStorage.getItem(NICK_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveNickname(nickname: string) {
  try {
    window.localStorage.setItem(NICK_KEY, nickname);
  } catch {
    // Storage blocked: the player just retypes it next time.
  }
}
