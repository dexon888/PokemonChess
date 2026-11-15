import { opponent, type Color } from "@pokemon-chess/engine";
import type { MatchSnapshot, MatchStats } from "@pokemon-chess/protocol";
import { useEffect, useRef } from "react";

const card = "rounded-2xl border border-line bg-card";

const WIN_REASON: Record<string, string> = {
  kingCaptured: "King captured",
  resignation: "Resignation",
  timeout: "Ran out of time",
  abandonment: "Opponent left the match",
};
const DRAW_REASON: Record<string, string> = {
  stalemate: "Stalemate",
  agreement: "Draw agreed",
  halfMoveLimit: "100 half-move rule",
  doubleKnockout: "Double knockout",
};

const ROWS: [string, keyof MatchStats][] = [
  ["Captures", "captures"],
  ["Super-effective hits", "superEffective"],
  ["Critical hits", "crits"],
  ["Successful dodges", "dodges"],
];

/**
 * Online results (PRD 6.7): who won and why, both players' battle stats (counted by the server),
 * and a rematch button that shows where the request stands (PRD 5.5).
 */
export function ResultsDialog({
  s,
  names,
  onRematch,
  onHome,
  onClose,
}: {
  s: MatchSnapshot;
  names: Record<Color, string>;
  onRematch: () => void;
  onHome: () => void;
  onClose: () => void;
}) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  const status = s.state.status;
  if (status.state === "active") return null;

  const you = s.you;
  const title =
    status.state === "draw"
      ? "Draw"
      : you
        ? status.winner === you
          ? "You win!"
          : "You lose"
        : `${names[status.winner]} wins`;
  const reason =
    status.state === "won"
      ? `${names[status.winner]} (${status.winner === "white" ? "White" : "Black"}) · ${
          WIN_REASON[status.reason] ?? status.reason
        }`
      : (DRAW_REASON[status.reason] ?? status.reason);

  const opp = you ? opponent(you) : null;
  const oppHere = opp ? (s.players.find((p) => p.color === opp)?.connected ?? false) : false;
  const youAsked = !!you && s.rematchRequestedBy.includes(you);
  const theyAsked = !!opp && s.rematchRequestedBy.includes(opp);
  const rematch = !you
    ? null
    : theyAsked && !youAsked
      ? { label: `Accept ${names[opp as Color]}'s rematch`, disabled: false }
      : youAsked
        ? { label: `Waiting for ${names[opp as Color]}…`, disabled: true }
        : !oppHere
          ? { label: `${names[opp as Color]} left`, disabled: true }
          : { label: "Rematch", disabled: false };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="results-title"
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4"
    >
      <div className={`${card} flex w-full max-w-md flex-col gap-5 p-6`}>
        <div>
          <h2 id="results-title" className="font-display text-3xl font-bold">
            {title}
          </h2>
          <p className="text-sm text-muted">{reason}</p>
          {s.game > 1 && <p className="mt-1 text-xs text-muted">Game {s.game} in this room</p>}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted">
              <th className="py-1 font-semibold">Battles</th>
              <th className="py-1 text-right font-semibold">{names.white}</th>
              <th className="py-1 text-right font-semibold">{names.black}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([label, key]) => (
              <tr key={key} className="border-t border-line">
                <td className="py-1.5">{label}</td>
                <td className="py-1.5 text-right tabular-nums">{s.stats.white[key]}</td>
                <td className="py-1.5 text-right tabular-nums">{s.stats.black[key]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {theyAsked && !youAsked && (
          <p role="status" className="rounded-xl border border-accent px-3 py-2 text-sm">
            {names[opp as Color]} wants a rematch. Colours swap and everyone gets new Pokémon.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {rematch && (
            <button
              ref={first}
              type="button"
              disabled={rematch.disabled}
              onClick={onRematch}
              className="h-12 rounded-xl bg-accent font-semibold text-ink-dark disabled:opacity-60"
            >
              {rematch.label}
            </button>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onHome}
              className="h-12 flex-1 rounded-xl border border-line bg-card-2 font-semibold"
            >
              Back to home
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-12 flex-1 rounded-xl border border-line bg-card-2 font-semibold"
            >
              View board
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
