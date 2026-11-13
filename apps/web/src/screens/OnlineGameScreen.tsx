import { opponent, type Color } from "@pokemon-chess/engine";
import { useEffect, useState } from "react";
import { AppHeader } from "../components/AppHeader";
import { GameOverDialog, type Presence } from "../components/Panels";
import type { OnlineMatch } from "../net/useOnlineMatch";
import { GameScreen } from "./GameScreen";

/** Re-renders a few times a second while something is counting down. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

const colorName = (c: Color) => (c === "white" ? "White" : "Black");

/** An online match: the server decides everything; this screen shows it and sends intents. */
export function OnlineGameScreen({ m }: { m: OnlineMatch }) {
  const s = m.snapshot;
  const game = m.view.game;
  const [flipOverride, setFlipOverride] = useState(false);
  const [showOver, setShowOver] = useState(true);
  useEffect(() => setShowOver(true), [game?.status]);

  const active = game?.status.state === "active";
  const counting =
    !!s && (!!s.clocks?.running || s.players.some((p) => !p.connected && p.graceEndsAt));
  const now = useNow(active && counting);
  if (!s || !game) return null;

  const elapsed = Math.max(0, now - m.receivedAt);
  const you = s.you;
  const opp = you ? opponent(you) : null;
  const player = (c: Color) => s.players.find((p) => p.color === c);
  const names = {
    white: player("white")?.nickname ?? "White",
    black: player("black")?.nickname ?? "Black",
  };

  const clocks = s.clocks
    ? (["white", "black"] as const).reduce(
        (acc, c) => {
          const running = s.clocks?.running === c;
          acc[c] = { ms: (s.clocks?.[c] ?? 0) - (running ? elapsed : 0), running };
          return acc;
        },
        {} as Record<Color, { ms: number; running: boolean }>,
      )
    : null;

  const presenceOf = (c: Color): Presence => {
    const p = player(c);
    if (!p || p.connected) return { connected: true, graceLeftMs: null };
    return {
      connected: false,
      graceLeftMs: p.graceEndsAt === null ? null : p.graceEndsAt - s.serverTime - elapsed,
    };
  };
  const presence = { white: presenceOf("white"), black: presenceOf("black") };
  const oppPresence = opp ? presence[opp] : null;
  const canClaim =
    active && !!oppPresence && !oppPresence.connected && (oppPresence.graceLeftMs ?? 0) <= 0;

  const theyOffered = active && !!opp && s.drawOfferFrom === opp;
  const youOffered = active && !!you && s.drawOfferFrom === you;

  const notices = (
    <>
      {m.connection === "reconnecting" && (
        <div role="status" className="rounded-xl border border-[#FBBF24] bg-card px-4 py-3 text-sm">
          Connection lost. Reconnecting…
        </div>
      )}
      {theyOffered && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent bg-card px-4 py-3"
        >
          <span className="text-sm">{names[opp as Color]} offers a draw.</span>
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={() => m.answerDraw(true)}>
              Accept
            </button>
            <button type="button" className="btn" onClick={() => m.answerDraw(false)}>
              Decline
            </button>
          </div>
        </div>
      )}
      {oppPresence && !oppPresence.connected && active && (
        <div role="status" className="rounded-xl border border-[#F87171] bg-card px-4 py-3 text-sm">
          {canClaim
            ? `${names[opp as Color]} has not come back. You can claim the win or keep waiting.`
            : `${names[opp as Color]} lost connection and has ${Math.ceil(
                (oppPresence.graceLeftMs ?? 0) / 1000,
              )}s to return. Their clock keeps running.`}
        </div>
      )}
      {m.notice && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3 text-sm"
        >
          <span>{m.notice}</span>
          <button type="button" className="text-muted underline" onClick={m.dismissNotice}>
            Dismiss
          </button>
        </div>
      )}
    </>
  );

  const actions = (
    <div className="flex flex-wrap gap-3">
      {canClaim && (
        <button
          type="button"
          onClick={m.claimVictory}
          className="h-12 flex-[1_1_100%] rounded-xl bg-accent font-semibold text-ink-dark"
        >
          Claim victory
        </button>
      )}
      <button
        type="button"
        disabled={!active || youOffered || theyOffered}
        onClick={m.offerDraw}
        className="btn h-12 flex-1"
      >
        {youOffered ? "Draw offered…" : "Offer draw"}
      </button>
      <button
        type="button"
        disabled={!active}
        onClick={() => window.confirm("Resign this match?") && m.resign()}
        className="btn btn-danger h-12 flex-1"
      >
        Resign
      </button>
    </div>
  );

  const flipped = (you === "black") !== flipOverride;

  return (
    <div className="min-h-screen bg-bg text-ink">
      <AppHeader
        badge={`Online · ${s.timeControl === "untimed" ? "untimed" : s.timeControl}${
          you ? ` · you play ${colorName(you)}` : ""
        }`}
      >
        <button type="button" onClick={() => setFlipOverride((f) => !f)} className="btn">
          Flip board
        </button>
        <button
          type="button"
          onClick={() =>
            (!active ||
              window.confirm("Leave this match? Your opponent can then claim the win.")) &&
            m.leave()
          }
          className="btn"
        >
          {active ? "Leave" : "Home"}
        </button>
      </AppHeader>

      <GameScreen
        view={m.view}
        game={game}
        flipped={flipped}
        names={names}
        you={you}
        clocks={clocks}
        presence={presence}
        notice={notices}
        actions={actions}
      />

      {showOver && (
        <GameOverDialog
          game={game}
          stats={m.view.stats}
          onNewGame={m.leave}
          newGameLabel="Back to home"
          onClose={() => setShowOver(false)}
        />
      )}
    </div>
  );
}
