import type { Room } from "@colyseus/sdk";
import type {
  ErrorMessage,
  LobbyMessage,
  MatchEventsMessage,
  MatchFoundMessage,
  MatchSnapshot,
  QueueMessage,
  TimeControlId,
} from "@pokemon-chess/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGameView, type MoveIntent } from "../game/useGameView";
import { gameClient, saveNickname, saveSession, savedSession } from "./client";

export type Phase =
  | { kind: "idle" }
  | { kind: "connecting"; label: string }
  | { kind: "searching"; queue: QueueMessage | null; note: string | null }
  | { kind: "lobby"; lobby: LobbyMessage }
  | { kind: "playing" }
  | { kind: "ended"; message: string }
  | { kind: "error"; message: string };

/** Turns SDK join failures into something a player can act on. */
function joinErrorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/not found/i.test(msg)) return "No room with that code. It may have expired; check the code.";
  if (/locked|full/i.test(msg)) return "That match already has two players.";
  if (/fetch|ECONNREFUSED|network/i.test(msg)) return "Can't reach the game server. Is it running?";
  return msg;
}

/**
 * One online visit: find a match or create/join a private room, wait, play. The server decides
 * every outcome; this hook only shows what it reports. `events` messages are animated when they
 * follow the last one seen; anything else (joining, a gap, a reconnect) loads the snapshot.
 *
 * The match this tab is in is saved in sessionStorage, so after a reload the tab rejoins its
 * seat with the reconnection token (R13) instead of starting over.
 */
export function useOnlineMatch() {
  const [phase, setPhase] = useState<Phase>(() =>
    savedSession() ? { kind: "connecting", label: "Rejoining your match…" } : { kind: "idle" },
  );
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  /** Local time the latest snapshot arrived, for counting clocks and grace down smoothly. */
  const [receivedAt, setReceivedAt] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [connection, setConnection] = useState<"ok" | "reconnecting">("ok");
  const roomRef = useRef<Room | null>(null);
  const queueRef = useRef<Room | null>(null);
  const seqRef = useRef<number | null>(null);
  const gameRef = useRef<number | null>(null);
  const nicknameRef = useRef("");
  const findMatchRef = useRef<(nickname: string, note?: string) => Promise<void>>(async () => {});

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

  const remember = (room: Room) =>
    saveSession({ roomId: room.roomId, reconnectionToken: room.reconnectionToken });

  /** Start following a match room: private, matchmade, or rejoined after a reload. */
  const attach = useCallback(
    (room: Room) => {
      roomRef.current = room;
      seqRef.current = null;
      gameRef.current = null;
      viewRef.current.reset(null);
      setSnapshot(null);
      setConnection("ok");
      remember(room);

      room.onMessage("lobby", (l: LobbyMessage) => setPhase({ kind: "lobby", lobby: l }));
      room.onMessage("snapshot", (s: MatchSnapshot) => {
        if (gameRef.current !== null && s.game !== gameRef.current) {
          // A rematch started (PRD 5.5): a clean slate, and say which colour you play now.
          viewRef.current.reset(s.state);
          setNotice(`Rematch! You play ${s.you === "white" ? "White" : "Black"} this time.`);
        } else if (seqRef.current !== s.seq || !viewRef.current.game) {
          viewRef.current.load(s.state);
        }
        gameRef.current = s.game;
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
        if (e.code === "roomExpired") {
          setPhase({ kind: "error", message: "Nobody joined in time, so this invite expired." });
        } else if (e.code === "matchCancelled") {
          // The paired opponent never arrived: go straight back into the queue (D8).
          void findMatchRef.current(
            nicknameRef.current,
            "Your last opponent didn't show up, so you're searching again.",
          );
        } else {
          setNotice(e.message);
        }
      });
      // Messages this client does not use (e.g. the dev playground's) are ignored.
      room.onMessage("*", () => {});
      room.onDrop(() => setConnection("reconnecting"));
      room.onReconnect(() => {
        setConnection("ok");
        remember(room); // the token changes on every reconnect
      });
      room.onLeave(() => {
        if (roomRef.current !== room) return;
        roomRef.current = null;
        saveSession(null);
        setPhase((p) =>
          p.kind === "error" || p.kind === "idle" || p.kind === "searching"
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
      nicknameRef.current = nickname;
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

  /** Join the matchmaking queue (PRD 5.1); `matchFound` moves us into the match. */
  const findMatch = useCallback(
    async (nickname: string, note?: string) => {
      roomRef.current = null;
      saveSession(null);
      nicknameRef.current = nickname;
      saveNickname(nickname);
      setNotice(null);
      setPhase({ kind: "searching", queue: null, note: note ?? null });
      let queue: Room;
      try {
        queue = await gameClient().joinOrCreate("queue", { nickname });
      } catch (err) {
        setPhase({ kind: "error", message: joinErrorText(err) });
        return;
      }
      queueRef.current = queue;
      queue.onMessage("queue", (q: QueueMessage) =>
        setPhase((p) => (p.kind === "searching" ? { ...p, queue: q } : p)),
      );
      queue.onMessage("matchFound", async (f: MatchFoundMessage) => {
        setPhase({ kind: "connecting", label: `Match found! Joining ${f.opponent.nickname}…` });
        queueRef.current = null;
        try {
          const match = await gameClient().consumeSeatReservation(f.reservation as never);
          attach(match);
        } catch (err) {
          setPhase({ kind: "error", message: joinErrorText(err) });
        } finally {
          void queue.leave();
        }
      });
      queue.onMessage("*", () => {});
      queue.onLeave(() => {
        if (queueRef.current !== queue) return;
        queueRef.current = null;
        setPhase({ kind: "error", message: "Lost the connection to matchmaking. Try again." });
      });
    },
    [attach],
  );
  findMatchRef.current = findMatch;

  /** Stop searching (leaving the queue cancels, PRD 5.1). */
  const cancelSearch = useCallback(() => {
    const queue = queueRef.current;
    queueRef.current = null;
    void queue?.leave();
    setPhase({ kind: "idle" });
  }, []);

  /** Leave the room (a deliberate leave: R18) and go back home. */
  const leave = useCallback(() => {
    const room = roomRef.current;
    roomRef.current = null;
    saveSession(null);
    void room?.leave();
    setPhase({ kind: "idle" });
    setSnapshot(null);
    viewRef.current.reset(null);
  }, []);

  // After a reload: rejoin the saved match once (StrictMode mounts effects twice in dev).
  const rejoinTried = useRef(false);
  useEffect(() => {
    if (rejoinTried.current) return;
    rejoinTried.current = true;
    const saved = savedSession();
    if (!saved) return;
    gameClient()
      .reconnect(saved.reconnectionToken)
      .then((room) => attach(room))
      .catch(() => {
        saveSession(null);
        setPhase({
          kind: "error",
          message: "Couldn't rejoin your match. It may have ended or closed.",
        });
      });
  }, [attach]);

  return {
    phase,
    snapshot,
    receivedAt,
    connection,
    notice,
    dismissNotice: () => setNotice(null),
    view,
    findMatch,
    cancelSearch,
    createPrivate,
    joinPrivate,
    leave,
    resign: () => send("resign"),
    offerDraw: () => send("offerDraw"),
    answerDraw: (accept: boolean) => send("answerDraw", { accept }),
    claimVictory: () => send("claimVictory"),
    rematch: () => send("rematch"),
  };
}

export type OnlineMatch = ReturnType<typeof useOnlineMatch>;
