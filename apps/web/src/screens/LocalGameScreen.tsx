import { useEffect, useState } from "react";
import { AppHeader } from "../components/AppHeader";
import { GameOverDialog } from "../components/Panels";
import { useLocalGame } from "../game/useLocalGame";
import { GameScreen } from "./GameScreen";

const confirmThen = (msg: string, fn: () => void) => () => {
  if (window.confirm(msg)) fn();
};

/** Hot-seat: two players, one screen, engine in the browser. */
export function LocalGameScreen() {
  const g = useLocalGame();
  const [flipped, setFlipped] = useState(false);
  const [showOver, setShowOver] = useState(true);
  useEffect(() => setShowOver(true), [g.game.status]);
  const active = g.game.status.state === "active";
  const mover = g.game.turn === "white" ? "White" : "Black";

  return (
    <div className="min-h-screen bg-bg text-ink">
      <AppHeader badge={`Local hot-seat · seed ${g.seed}`}>
        <button type="button" onClick={() => setFlipped((f) => !f)} className="btn">
          Flip board
        </button>
        <button type="button" onClick={confirmThen("Start a new game?", g.reset)} className="btn">
          New game
        </button>
      </AppHeader>

      <GameScreen
        view={g}
        game={g.game}
        flipped={flipped}
        names={{ white: "White", black: "Black" }}
        actions={
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
        }
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
