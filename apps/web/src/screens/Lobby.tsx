import type { LobbyMessage } from "@pokemon-chess/protocol";
import { useEffect, useState } from "react";
import { AppHeader } from "../components/AppHeader";
import { inviteLink } from "../net/client";

const card = "rounded-2xl border border-line bg-card p-5 sm:p-6";

/** Private lobby (PRD 6.6): share the code, wait for the opponent. */
export function Lobby({ lobby, onLeave }: { lobby: LobbyMessage; onLeave: () => void }) {
  const [copied, setCopied] = useState(false);
  const [receivedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const link = inviteLink(lobby.roomId);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this invite link", link);
    }
  };
  const minutesLeft =
    lobby.expiresAt === null
      ? null
      : Math.max(0, Math.ceil((lobby.expiresAt - lobby.serverTime - (now - receivedAt)) / 60_000));

  return (
    <div className="min-h-screen bg-bg text-ink">
      <AppHeader badge="Private match">
        <button type="button" className="btn" onClick={onLeave}>
          Cancel
        </button>
      </AppHeader>
      <main className="mx-auto flex max-w-[560px] flex-col gap-5 px-4 py-8">
        <div className={`${card} flex flex-col items-center gap-4 text-center`}>
          <p className="text-sm text-muted">Room code</p>
          <p
            className="font-display text-5xl font-bold tracking-[0.25em]"
            aria-label={`Room code ${lobby.roomId.split("").join(" ")}`}
          >
            {lobby.roomId}
          </p>
          <button
            type="button"
            onClick={copy}
            className="h-12 w-full rounded-xl bg-accent font-semibold text-ink-dark"
          >
            {copied ? "Link copied!" : "Copy invite link"}
          </button>
          <p className="break-all text-xs text-muted">{link}</p>
        </div>

        <div className={card}>
          <h2 className="mb-3 font-display text-lg font-semibold">Players</h2>
          <ul className="flex flex-col gap-2">
            {lobby.players.map((p, i) => (
              <li key={i} className="flex items-center justify-between">
                <span>{p.nickname}</span>
                <span className="text-xs text-muted">{i === 0 ? "Host" : "Guest"}</span>
              </li>
            ))}
            {lobby.players.length < 2 && (
              <li className="flex items-center gap-3 text-muted" aria-live="polite">
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden="true" />
                Waiting for your opponent…
              </li>
            )}
          </ul>
          <p className="mt-4 text-sm text-muted">
            Time control: {lobby.timeControl === "untimed" ? "untimed" : lobby.timeControl}. The
            match starts as soon as they join; colours are random.
            {minutesLeft !== null && ` This invite expires in ${minutesLeft} min.`}
          </p>
        </div>
      </main>
    </div>
  );
}
