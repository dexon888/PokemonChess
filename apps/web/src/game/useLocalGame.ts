import {
  applyAction,
  createRandomStartingPosition,
  createSeededRng,
  movesFrom,
  newGame,
  opponent,
  squareName,
  type Action,
  type BattleOutcome,
  type Color,
  type GameEvent,
  type GameState,
  type Move,
  type Piece,
  type Rng,
  type Role,
  type Square,
} from "@pokemon-chess/engine";
import { ROSTER_V1 } from "@pokemon-chess/roster";
import { useCallback, useMemo, useRef, useState } from "react";
import { motionFromEvents, type Motion } from "./motion";
import { ROLE_NAME } from "./theme";

export type LogTag =
  "MOVE" | "2×" | "CRIT" | "KO" | "½×" | "0×" | "DODGE" | "PROMO" | "BONUS" | "END";

export interface LogEntry {
  id: number;
  tag: LogTag;
  text: string;
  color: Color | null;
}

export interface Banner {
  id: number;
  outcome: BattleOutcome | "crit";
  title: string;
  line: string;
}

export interface Stats {
  captures: number;
  superEffective: number;
  crits: number;
  dodges: number;
}

const emptyStats = (): Stats => ({ captures: 0, superEffective: 0, crits: 0, dodges: 0 });

function randomSeed(): number {
  const fromUrl = Number(new URLSearchParams(window.location.search).get("seed"));
  if (Number.isInteger(fromUrl) && fromUrl > 0) return fromUrl;
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
}

const colorName = (c: Color) => (c === "white" ? "White" : "Black");

/**
 * Local hot-seat game. For this prototype the engine runs in the browser; online play (M4)
 * moves all resolution to the server.
 */
export function useLocalGame() {
  const [seed, setSeed] = useState(randomSeed);
  const rngRef = useRef<Rng>(createSeededRng(seed));
  const [game, setGame] = useState<GameState>(() =>
    newGame(createRandomStartingPosition(ROSTER_V1, rngRef.current)),
  );
  const [selected, setSelected] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<Move | null>(null);
  const [stats, setStats] = useState<Record<Color, Stats>>({
    white: emptyStats(),
    black: emptyStats(),
  });
  const [hitSquare, setHitSquare] = useState<{
    sq: Square;
    kind: BattleOutcome;
    id: number;
  } | null>(null);
  const [motion, setMotion] = useState<Motion | null>(null);
  const counter = useRef(0);

  const moves = useMemo(
    () => (selected === null || game.status.state !== "active" ? [] : movesFrom(game, selected)),
    [game, selected],
  );

  const reset = useCallback(() => {
    const next = crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
    rngRef.current = createSeededRng(next);
    setSeed(next);
    setGame(newGame(createRandomStartingPosition(ROSTER_V1, rngRef.current)));
    setSelected(null);
    setLastMove(null);
    setLog([]);
    setBanner(null);
    setPendingPromotion(null);
    setHitSquare(null);
    setMotion(null);
    setStats({ white: emptyStats(), black: emptyStats() });
  }, []);

  const dispatch = useCallback(
    (action: Action) => {
      const before = game;
      const { state, events } = applyAction(before, action, rngRef.current);
      const byId = new Map<string, Piece>();
      before.board.forEach((p) => p && byId.set(p.id, p));
      const name = (id: string) => byId.get(id)?.species ?? "?";

      const entries: LogEntry[] = [];
      const push = (tag: LogTag, text: string, color: Color | null) =>
        entries.push({ id: ++counter.current, tag, text, color });
      const nextStats = { white: { ...stats.white }, black: { ...stats.black } };

      for (const e of events) describe(e);
      function describe(e: GameEvent) {
        switch (e.type) {
          case "move":
            push(
              "MOVE",
              `${name(e.pieceId)} moved ${squareName(e.from)} → ${squareName(e.to)}.`,
              e.color,
            );
            break;
          case "castle":
            push("MOVE", `${colorName(e.color)} castled.`, e.color);
            break;
          case "promotion":
            push("PROMO", `${name(e.pieceId)} was promoted to ${ROLE_NAME[e.role]}.`, e.color);
            break;
          case "bonusTurn":
            push("BONUS", `${colorName(e.color)} moves again!`, e.color);
            break;
          case "gameOver": {
            const s = e.status;
            const text =
              s.state === "won"
                ? `${colorName(s.winner)} wins by ${winText(s.reason)}.`
                : `Draw by ${drawText(s.reason)}.`;
            push("END", text, null);
            break;
          }
          case "battle": {
            const a = name(e.attackerId);
            const d = name(e.defenderId);
            const attacker = byId.get(e.attackerId);
            const r = e.result;
            const st = nextStats[e.color];
            const def = nextStats[opponent(e.color)];
            let b: Omit<Banner, "id">;
            if (r.outcome === "immune") {
              push(
                "0×",
                `No effect! ${d} is immune to ${a}'s ${attacker?.type ?? ""} attack.`,
                e.color,
              );
              b = { outcome: "immune", title: "No effect!", line: `${d} is immune.` };
            } else if (r.outcome === "dodged") {
              def.dodges++;
              push("DODGE", `${d} dodged ${a}'s attack!`, e.color);
              b = { outcome: "dodged", title: "Dodged!", line: `${d} avoided the attack.` };
            } else if (r.outcome === "superEffective") {
              st.captures++;
              st.superEffective++;
              push("2×", `Super effective! ${a} knocked out ${d}.`, e.color);
              b = {
                outcome: "superEffective",
                title: "Super effective!",
                line: `${a} knocked out ${d}.`,
              };
            } else if (r.outcome === "resisted") {
              st.captures++;
              push("½×", `Not very effective… ${a} and ${d} both fainted.`, e.color);
              b = {
                outcome: "resisted",
                title: "Not very effective…",
                line: `${a} and ${d} both fainted.`,
              };
            } else if (r.crit) {
              st.captures++;
              st.crits++;
              push("CRIT", `Critical hit! ${a} knocked out ${d}.`, e.color);
              b = { outcome: "crit", title: "Critical hit!", line: `${a} knocked out ${d}.` };
            } else {
              st.captures++;
              push("KO", `${a} knocked out ${d}.`, e.color);
              b = { outcome: "captured", title: "Knocked out", line: `${a} knocked out ${d}.` };
            }
            setBanner({ ...b, id: ++counter.current });
            setHitSquare({ sq: e.defenderSquare, kind: r.outcome, id: counter.current });
            break;
          }
        }
      }

      setMotion(motionFromEvents(before, events, ++counter.current));
      if (action.type === "move") setLastMove({ from: action.from, to: action.to });
      setStats(nextStats);
      setLog((l) => [...entries.reverse(), ...l]);
      setGame(state);
      setSelected(null);
      setPendingPromotion(null);
    },
    [game, stats],
  );

  const clickSquare = useCallback(
    (sq: Square) => {
      if (game.status.state !== "active" || pendingPromotion) return;
      const piece = game.board[sq];
      const move = moves.find((m) => m.to === sq);
      if (selected !== null && move) {
        if (move.promotes) setPendingPromotion(move);
        else dispatch({ type: "move", from: move.from, to: move.to });
        return;
      }
      if (piece && piece.color === game.turn) setSelected(sq === selected ? null : sq);
      else setSelected(null);
    },
    [game, moves, selected, pendingPromotion, dispatch],
  );

  const promote = useCallback(
    (role: Role) => {
      if (!pendingPromotion) return;
      dispatch({
        type: "move",
        from: pendingPromotion.from,
        to: pendingPromotion.to,
        promotion: role,
      });
    },
    [pendingPromotion, dispatch],
  );

  return {
    seed,
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
    resign: () => dispatch({ type: "resign", color: game.turn }),
    agreeDraw: () => dispatch({ type: "agreeDraw" }),
    reset,
  };
}

function winText(r: string) {
  return r === "kingCaptured" ? "capturing the king" : r;
}

function drawText(r: string) {
  return (
    {
      stalemate: "stalemate",
      agreement: "agreement",
      halfMoveLimit: "the 100 half-move rule",
      doubleKnockout: "double knockout",
    }[r] ?? r
  );
}
