import { useCallback, useEffect, useState } from "react";
import { Board } from "./components/Board";
import {
  BattleLog,
  GameOverDialog,
  OutcomeBanner,
  PlayerBar,
  PromotionDialog,
  SelectedPanel,
} from "./components/Panels";
import { useLocalGame } from "./game/useLocalGame";

function useBoardSize() {
  const calc = () => Math.max(300, Math.min(640, window.innerWidth - 32, window.innerHeight - 220));
  const [size, setSize] = useState(calc);
  useEffect(() => {
    const onResize = () => setSize(calc());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return Math.floor(size / 8) * 8;
}

export function App() {
  const g = useLocalGame();
  const size = useBoardSize();
  const [flipped, setFlipped] = useState(false);
  const [banner, setBanner] = useState(g.banner);
  const [showOver, setShowOver] = useState(true);
  useEffect(() => setBanner(g.banner), [g.banner]);
  useEffect(() => setShowOver(true), [g.game.status]);
  const clearBanner = useCallback(() => setBanner(null), []);

  const confirmThen = (msg: string, fn: () => void) => () => {
    if (window.confirm(msg)) fn();
  };
  const active = g.game.status.state === "active";
  const mover = g.game.turn === "white" ? "White" : "Black";

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-2 bg-[#0E1428] px-4 py-3 sm:px-8">
        <div className="flex items-center gap-4">
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
            <rect width="14" height="14" rx="3" fill="#6EA8FE" />
            <rect x="14" y="14" width="14" height="14" rx="3" fill="#6EA8FE" />
            <rect x="14" width="14" height="14" rx="3" fill="#26305A" />
            <rect y="14" width="14" height="14" rx="3" fill="#26305A" />
          </svg>
          <span className="font-display text-xl font-bold tracking-tight">Pokémon Chess</span>
          <span className="hidden rounded-full border border-line bg-card px-3 py-1 text-[13px] text-muted sm:inline">
            Local hot-seat · seed {g.seed}
          </span>
        </div>
        <nav className="flex items-center gap-2" aria-label="Game controls">
          <button type="button" onClick={() => setFlipped((f) => !f)} className="btn">
            Flip board
          </button>
          <button type="button" onClick={confirmThen("Start a new game?", g.reset)} className="btn">
            New game
          </button>
        </nav>
      </header>

      <main className="mx-auto flex max-w-[1376px] flex-wrap items-start gap-6 px-4 py-6 sm:px-8">
        <section aria-label="Board" className="flex flex-col gap-3" style={{ width: size }}>
          <PlayerBar
            game={g.game}
            color={flipped ? "white" : "black"}
            name={flipped ? "White" : "Black"}
          />
          <div className="relative">
            <Board
              game={g.game}
              selected={g.selected}
              moves={g.moves}
              lastMove={g.lastMove}
              hitSquare={g.hitSquare}
              motion={g.motion}
              flipped={flipped}
              size={size}
              onSquare={g.clickSquare}
            />
            <OutcomeBanner banner={banner} onDone={clearBanner} />
          </div>
          <PlayerBar
            game={g.game}
            color={flipped ? "black" : "white"}
            name={flipped ? "Black" : "White"}
          />
        </section>

        <aside className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
          <SelectedPanel game={g.game} selected={g.selected} moves={g.moves} />
          <BattleLog log={g.log} />
          <div className="flex gap-3">
            <button
              type="button"
              disabled={!active}
              onClick={confirmThen("Both players agree to a draw?", g.agreeDraw)}
              className="btn h-12 flex-1"
            >
              Agree draw
            </button>
            <button
              type="button"
              disabled={!active}
              onClick={confirmThen(`${mover} resigns?`, g.resign)}
              className="btn btn-danger h-12 flex-1"
            >
              {active ? `${mover} resigns` : "Resign"}
            </button>
          </div>
        </aside>
      </main>

      <PromotionDialog
        open={!!g.pendingPromotion}
        onPick={g.promote}
        onCancel={g.cancelPromotion}
      />
      {showOver && (
        <GameOverDialog
          game={g.game}
          stats={g.stats}
          onNewGame={g.reset}
          onClose={() => setShowOver(false)}
        />
      )}
    </div>
  );
}
