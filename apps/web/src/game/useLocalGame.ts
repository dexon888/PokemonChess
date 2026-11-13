import {
  applyAction,
  createRandomStartingPosition,
  createSeededRng,
  newGame,
  type Action,
  type ActionResult,
  type GameState,
  type Rng,
} from "@pokemon-chess/engine";
import { ROSTER_V1 } from "@pokemon-chess/roster";
import { useCallback, useRef, useState } from "react";
import { useGameView, type MoveIntent } from "./useGameView";

export type { Banner, LogEntry, LogTag, Stats } from "./narrate";

function randomSeed(): number {
  const fromUrl = Number(new URLSearchParams(window.location.search).get("seed"));
  if (Number.isInteger(fromUrl) && fromUrl > 0) return fromUrl;
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
}

const freshGame = (rng: Rng) => newGame(createRandomStartingPosition(ROSTER_V1, rng));

/**
 * Local hot-seat game: the engine runs in the browser and both players share the board. Online
 * play uses the same view (useGameView) but takes every outcome from the server.
 */
export function useLocalGame() {
  const [seed, setSeed] = useState(randomSeed);
  const rngRef = useRef<Rng>(createSeededRng(seed));
  const [initial] = useState(() => freshGame(rngRef.current));
  const gameRef = useRef<GameState>(initial);
  // The view is created below (it needs onMove); this forwards engine results to it.
  const commitRef = useRef<(result: ActionResult) => void>(() => {});

  const dispatch = useCallback((action: Action) => {
    const result = applyAction(gameRef.current, action, rngRef.current);
    gameRef.current = result.state;
    commitRef.current(result);
  }, []);
  const onMove = useCallback((m: MoveIntent) => dispatch({ type: "move", ...m }), [dispatch]);

  const view = useGameView(initial, { controls: "both", onMove });
  commitRef.current = (r) => view.commit(r.events, r.state);

  const reset = useCallback(() => {
    const next = crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
    rngRef.current = createSeededRng(next);
    setSeed(next);
    gameRef.current = freshGame(rngRef.current);
    view.reset(gameRef.current);
  }, [view]);

  const game = view.game ?? initial;
  return {
    ...view,
    game,
    seed,
    resign: () => dispatch({ type: "resign", color: game.turn }),
    agreeDraw: () => dispatch({ type: "agreeDraw" }),
    reset,
  };
}
