import type { Room } from "@colyseus/sdk";
import type {
  ErrorMessage,
  LobbyMessage,
  MatchEventsMessage,
  MatchSnapshot,
  TimeControlId,
} from "@pokemon-chess/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGameView, type MoveIntent } from "../game/useGameView";
import { gameClient, saveNickname } from "./client";

export type Phase =
  | { kind: "idle" }
  | { kind: "connecting"; label: string }
  | { kind: "lobby"; lobby: LobbyMessage }
  | { kind: "playing" }
  | { kind: "ended"; message: string }
  | { kind: "error"; message: string };

/** Server errors that end the visit to a room, with what to tell the player. */
const FATAL: Partial<Record<ErrorMessage["code"], string>> = {
  roomExpired: "Nobody joined in time, so this invite expired.",
  matchCancelled: "Your opponent did not arrive. Search again.",
};

/** Turns SDK join failures into something a player can act on. */
function joinErrorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/not found/i.test(msg)) return "No room with that code. It may have expired; check the code.";
  if (/locked|full/i.test(msg)) return "That match already has two players.";
  if (/fetch|ECONNREFUSED|network/i.test(msg)) return "Can't reach the game server. Is it running?";
  return msg;
}

/**
 * One online visit: create or join a room, wait in the lobby, play. The server decides every
 * outcome; this hook only shows what it reports. `events` messages are animated when they follow
 * the last one seen; anything else (joining, a gap, a reconnect) loads the snapshot directly.
 */
export function useOnlineMatch() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  /** Local time the latest snapshot arrived, for counting clocks and grace down smoothly. */
  const [receivedAt, setReceivedAt] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [connection, setConnection] = useState<"ok" | "reconnecting">("ok");
  const roomRef = useRef<Room | null>(null);
  const seqRef = useRef<number | null>(null);

  const send = useCallback((type: string, payload?: unknown) => {
    roomRef.current?.send(type, payload);
  }, []);
  const onMove = useCallback((m: MoveIntent) => send("move", m), [send]);
  const view = useGameView(null, { controls: snapshot?.you ?? "none", onMove });
  const viewRef = useRef(view);
  viewRef.current = view;

  const take = useCallback((s: MatchSnapshot) => {
    setSnapshot(s);
    setReceivedAt(Date.now());
    setPhase((p) => (p.kind === "ended" ? p : { kind: "playing" }));
  }, []);

  const attach = useCallback(
    (room: Room) => {
      roomRef.current = room;
      seqRef.current = null;
      viewRef.current.reset(null);
      setSnapshot(null);
      setConnection("ok");

      room.onMessage("lobby", (l: LobbyMessage) => setPhase({ kind: "lobby", lobby: l }));
      room.onMessage("snapshot", (s: MatchSnapshot) => {
        if (seqRef.current !== s.seq || !viewRef.current.game) viewRef.current.load(s.state);
        seqRef.current = s.seq;
        take(s);
      });
      room.onMessage("events", (m: MatchEventsMessage) => {
        if (seqRef.current !== null && m.seq === seqRef.current + 1) {
          viewRef.current.commit(m.events, m.snapshot.state);
        } else {
          viewRef.current.load(m.snapshot.state);
        }
        seqRef.current = m.seq;
        take(m.snapshot);
      });
      room.onMessage("error", (e: ErrorMessage) => {
        const fatal = FATAL[e.code];
        if (fatal) setPhase({ kind: "error", message: fatal });
        else setNotice(e.message);
      });
      // Messages this client does not use (e.g. the dev playground's) are ignored.
      room.onMessage("*", () => {});
      room.onDrop(() => setConnection("reconnecting"));
      room.onReconnect(() => setConnection("ok"));
      room.onLeave(() => {
        if (roomRef.current !== room) return;
        roomRef.current = null;
        setPhase((p) =>
          p.kind === "error" || p.kind === "idle"
            ? p
            : { kind: "ended", message: "You left the match." },
        );
      });
    },
    [take],
  );

  const enter = useCallback(
    async (label: string, nickname: string, join: () => Promise<Room>) => {
      setPhase({ kind: "connecting", label });
      setNotice(null);
      saveNickname(nickname);
      try {
        attach(await join());
      } catch (err) {
        setPhase({ kind: "error", message: joinErrorText(err) });
      }
    },
    [attach],
  );

  const createPrivate = useCallback(
    (nickname: string, timeControl: TimeControlId) =>
      enter("Creating your room…", nickname, () =>
        gameClient().create("private", { nickname, timeControl }),
      ),
    [enter],
  );

  const joinPrivate = useCallback(
    (code: string, nickname: string) =>
      enter("Joining…", nickname, () => gameClient().joinById(code, { nickname })),
    [enter],
  );

  /** Leave the room (a deliberate leave: R18) and go back home. */
  const leave = useCallback(() => {
    const room = roomRef.current;
    roomRef.current = null;
    void room?.leave();
    setPhase({ kind: "idle" });
    setSnapshot(null);
    viewRef.current.reset(null);
  }, []);

  useEffect(() => () => void roomRef.current?.leave(), []);

  return {
    phase,
    snapshot,
    receivedAt,
    connection,
    notice,
    dismissNotice: () => setNotice(null),
    view,
    createPrivate,
    joinPrivate,
    leave,
    resign: () => send("resign"),
    offerDraw: () => send("offerDraw"),
    answerDraw: (accept: boolean) => send("answerDraw", { accept }),
    claimVictory: () => send("claimVictory"),
  };
}

export type OnlineMatch = ReturnType<typeof useOnlineMatch>;
