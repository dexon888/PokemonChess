import type { Color, GameState } from "@pokemon-chess/engine";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Board } from "../components/Board";
import {
  BattleLog,
  OutcomeBanner,
  PlayerBar,
  PromotionDialog,
  SelectedPanel,
  type Presence,
} from "../components/Panels";
import type { GameView } from "../game/useGameView";

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

export interface GameScreenProps {
  view: GameView;
  game: GameState;
  flipped: boolean;
  names: Record<Color, string>;
  you?: Color | null;
  clocks?: Record<Color, { ms: number; running: boolean }> | null;
  presence?: Record<Color, Presence>;
  /** Shown above the side panel, e.g. a connection or draw-offer notice. */
  notice?: ReactNode;
  /** Buttons under the battle log (draw, resign, claim victory…). */
  actions: ReactNode;
}

/** The board screen shared by local and online play (Game Screen v1). */
export function GameScreen({
  view,
  game,
  flipped,
  names,
  you,
  clocks,
  presence,
  notice,
  actions,
}: GameScreenProps) {
  const size = useBoardSize();
  const [banner, setBanner] = useState(view.banner);
  useEffect(() => setBanner(view.banner), [view.banner]);
  const clearBanner = useCallback(() => setBanner(null), []);

  const bar = (color: Color) => (
    <PlayerBar
      game={game}
      color={color}
      name={names[color]}
      isYou={you === color}
      clock={clocks?.[color] ?? null}
      {...(presence ? { presence: presence[color] } : {})}
    />
  );
  const top: Color = flipped ? "white" : "black";
  const bottom: Color = flipped ? "black" : "white";

  return (
    <>
      <main className="mx-auto flex max-w-[1376px] flex-wrap items-start gap-6 px-4 py-6 sm:px-8">
        <section aria-label="Board" className="flex flex-col gap-3" style={{ width: size }}>
          {bar(top)}
          <div className="relative">
            <Board
              game={game}
              selected={view.selected}
              moves={view.moves}
              lastMove={view.lastMove}
              hitSquare={view.hitSquare}
              motion={view.motion}
              flipped={flipped}
              size={size}
              onSquare={view.clickSquare}
              onCancel={view.clearSelection}
            />
            <OutcomeBanner banner={banner} onDone={clearBanner} />
          </div>
          {bar(bottom)}
        </section>

        <aside className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
          {notice}
          <SelectedPanel game={game} selected={view.selected} moves={view.moves} />
          <BattleLog log={view.log} />
          {actions}
        </aside>
      </main>

      <PromotionDialog
        open={!!view.pendingPromotion}
        onPick={view.promote}
        onCancel={view.cancelPromotion}
      />
    </>
  );
}
