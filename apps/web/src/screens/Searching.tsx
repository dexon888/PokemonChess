import type { QueueMessage } from "@pokemon-chess/protocol";
import { useEffect, useState } from "react";
import { AppHeader } from "../components/AppHeader";

/** Matchmaking (PRD 6.5): searching status, a loading indicator, cancel. */
export function Searching({
  queue,
  note,
  onCancel,
}: {
  queue: QueueMessage | null;
  note: string | null;
  onCancel: () => void;
}) {
  // Elapsed time counts from the server's joinedAt, measured against when the status arrived.
  const [arrived, setArrived] = useState(() => Date.now());
  useEffect(() => setArrived(Date.now()), [queue]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const elapsedS = queue
    ? Math.max(0, Math.floor((queue.serverTime - queue.joinedAt + (now - arrived)) / 1000))
    : 0;
  const elapsed = `${Math.floor(elapsedS / 60)}:${String(elapsedS % 60).padStart(2, "0")}`;
  const others = queue ? queue.searching - 1 : 0;

  return (
    <div className="min-h-screen bg-bg text-ink">
      <AppHeader badge="Find a match" />
      <main className="mx-auto flex max-w-[480px] flex-col items-center gap-6 px-4 py-12 text-center">
        <div className="relative h-24 w-24" aria-hidden="true">
          <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-30" />
          <span className="absolute inset-4 rounded-full border-4 border-accent" />
        </div>
        <div role="status" aria-live="polite">
          <h1 className="font-display text-2xl font-bold">Searching for an opponent…</h1>
          <p className="mt-2 text-muted">
            {queue
              ? `${elapsed} · ${others === 0 ? "no one else searching yet" : `${others} other${others === 1 ? "" : "s"} searching`} · ${queue.timeControl}`
              : "Joining the queue…"}
          </p>
        </div>
        {note && <p className="rounded-xl border border-line bg-card px-4 py-3 text-sm">{note}</p>}
        <p className="text-sm text-muted">
          You'll be paired with the next player who searches. Colours and Pokémon are random.
        </p>
        <button type="button" onClick={onCancel} className="btn h-12 w-full max-w-[240px]">
          Cancel search
        </button>
      </main>
    </div>
  );
}
