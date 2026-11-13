import {
  movesFrom,
  type Color,
  type GameEvent,
  type GameState,
  type Move,
  type Role,
  type Square,
} from "@pokemon-chess/engine";
import { useCallback, useMemo, useRef, useState } from "react";
import { motionFromEvents, type Motion } from "./motion";
import {
  emptyBothStats,
  narrate,
  type Banner,
  type HitSquare,
  type LogEntry,
  type Stats,
} from "./narrate";

export interface MoveIntent {
  from: Square;
  to: Square;
  promotion?: Role;
}

export interface ViewOptions {
  /** Who may pick up pieces: both sides (hot-seat) or only your own colour (online). */
  controls: Color | "both" | "none";
  /** Called when the player completes a move (after choosing a promotion piece if needed). */
  onMove: (move: MoveIntent) => void;
}

/**
 * Everything the board screen shows, for local and online play alike: the game, log, banner,
 * animations, stats and the player's selection. It never decides an outcome; it is told what
 * happened through `commit` (events + the state after them) or `load` (a snapshot).
 */
export function useGameView(initial: GameState | null, opts: ViewOptions) {
  const [game, setGame] = useState<GameState | null>(initial);
  const gameRef = useRef(game);
  const [selected, setSelected] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<Move | null>(null);
  const [stats, setStats] = useState<Record<Color, Stats>>(emptyBothStats);
  const statsRef = useRef(stats);
  const [hitSquare, setHitSquare] = useState<HitSquare | null>(null);
  const [motion, setMotion] = useState<Motion | null>(null);
  const counter = useRef(0);
  const nextId = useCallback(() => ++counter.current, []);

  const setBoth = (g: GameState | null) => {
    gameRef.current = g;
    setGame(g);
  };

  /** Start over with a new game (or none). */
  const reset = useCallback((g: GameState | null) => {
    setBoth(g);
    statsRef.current = emptyBothStats();
    setStats(statsRef.current);
    setSelected(null);
    setLastMove(null);
    setLog([]);
    setBanner(null);
    setPendingPromotion(null);
    setHitSquare(null);
    setMotion(null);
  }, []);

  /** Show a state without animating: joining, reconnecting, or a gap in the event stream. */
  const load = useCallback((g: GameState) => {
    setBoth(g);
    setMotion(null);
    setPendingPromotion(null);
    setSelected((s) => (s !== null && g.board[s]?.color === g.turn ? s : null));
  }, []);

  /** One action happened: describe and animate its events, then show the state after it. */
  const commit = useCallback(
    (events: GameEvent[], after: GameState) => {
      const before = gameRef.current;
      if (!before) {
        load(after);
        return;
      }
      const n = narrate(before, events, statsRef.current, nextId);
      statsRef.current = n.stats;
      setStats(n.stats);
      if (n.entries.length) setLog((l) => [...n.entries, ...l]);
      if (n.banner) setBanner(n.banner);
      if (n.hit) setHitSquare(n.hit);
      if (n.lastMove) setLastMove(n.lastMove);
      setMotion(motionFromEvents(before, events, nextId()));
      setBoth(after);
      setSelected(null);
      setPendingPromotion(null);
    },
    [load, nextId],
  );

  const canPick = useCallback(
    (g: GameState, sq: Square) => {
      const piece = g.board[sq];
      if (!piece || piece.color !== g.turn || g.status.state !== "active") return false;
      return opts.controls === "both" || opts.controls === piece.color;
    },
    [opts.controls],
  );

  const moves = useMemo(
    () => (game && selected !== null && canPick(game, selected) ? movesFrom(game, selected) : []),
    [game, selected, canPick],
  );

  const { onMove } = opts;
  const clickSquare = useCallback(
    (sq: Square) => {
      if (!game || game.status.state !== "active" || pendingPromotion) return;
      const move = moves.find((m) => m.to === sq);
      if (selected !== null && move) {
        if (move.promotes) setPendingPromotion(move);
        else onMove({ from: move.from, to: move.to });
        return;
      }
      setSelected(canPick(game, sq) && sq !== selected ? sq : null);
    },
    [game, moves, selected, pendingPromotion, canPick, onMove],
  );

  const promote = useCallback(
    (role: Role) => {
      if (!pendingPromotion) return;
      onMove({ from: pendingPromotion.from, to: pendingPromotion.to, promotion: role });
      setPendingPromotion(null);
    },
    [pendingPromotion, onMove],
  );

  return {
    game,
    selected,
    moves,
    lastMove,
    log,
    banner,
    hitSquare,
    motion,
    stats,
    pendingPromotion,
    clickSquare,
    promote,
    cancelPromotion: () => setPendingPromotion(null),
    clearSelection: () => setSelected(null),
    commit,
    load,
    reset,
  };
}

export type GameView = ReturnType<typeof useGameView>;
