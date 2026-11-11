import {
  effectiveness,
  kingThreatened,
  squareName,
  type Color,
  type GameState,
  type Move,
  type PokemonType,
  type Role,
  type Square,
} from "@pokemon-chess/engine";
import { useEffect, useRef, useState } from "react";
import type { Banner, LogEntry, LogTag, Stats } from "../game/narrate";
import { EFFECT_RESULT, EFFECT_STYLE, ROLE_NAME, TYPE_COLOR, typeTextColor } from "../game/theme";
import { PieceIcon } from "./PieceIcon";
import { Sprite } from "./Sprite";

const card = "rounded-2xl border border-line bg-card";

export function TypeChip({ type }: { type: PokemonType }) {
  return (
    <span
      className="rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide"
      style={{ background: TYPE_COLOR[type], color: typeTextColor(type) }}
    >
      {type}
    </span>
  );
}

/** Remaining time as m:ss, or s.t under ten seconds. */
export function formatClock(ms: number): string {
  const t = Math.max(0, ms);
  if (t < 10_000) return (Math.floor(t / 100) / 10).toFixed(1);
  const total = Math.ceil(t / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export interface Presence {
  connected: boolean;
  /** While offline: ms left in the reconnect grace (R12); 0 once it has run out. */
  graceLeftMs: number | null;
}

export function PlayerBar({
  game,
  color,
  name,
  clock,
  presence,
  isYou,
}: {
  game: GameState;
  color: Color;
  name: string;
  clock?: { ms: number; running: boolean } | null;
  presence?: Presence;
  isYou?: boolean;
}) {
  const active = game.status.state === "active" && game.turn === color;
  const left = game.board.filter((p) => p?.color === color).length;
  const threatened = game.status.state === "active" && kingThreatened(game, color);
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 bg-card px-3 py-2 ${
        active ? "border-accent" : "border-transparent outline outline-1 outline-line"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-xs font-bold ${
            color === "white"
              ? "border-accent bg-[#F4F6FF] text-ink-dark"
              : "border-muted bg-[#070A14]"
          }`}
        >
          {color === "white" ? "W" : "B"}
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-semibold">
            {name}
            {isYou ? " (you)" : ""}
            {active ? " · to move" : ""}
          </span>
          <span className="text-xs text-muted">
            {color === "white" ? "White" : "Black"} · {left} pieces left
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {threatened && (
          <span className="rounded-full bg-[#F87171] px-3 py-1 text-xs font-semibold text-[#2A0707]">
            King threatened!
          </span>
        )}
        {active && game.bonusTurn && (
          <span className="rounded-full bg-[#FBBF24] px-3 py-1 text-[13px] font-semibold text-[#1A1405]">
            Bonus turn · move again
          </span>
        )}
        {presence && !presence.connected && (
          <span
            role="status"
            className="rounded-full border border-[#F87171] px-3 py-1 text-xs font-semibold text-[#FCA5A5]"
          >
            Offline
            {presence.graceLeftMs !== null && presence.graceLeftMs > 0
              ? ` · ${Math.ceil(presence.graceLeftMs / 1000)}s to return`
              : ""}
          </span>
        )}
        {clock && (
          <span
            aria-label={`${color} clock ${formatClock(clock.ms)}`}
            className={`min-w-[72px] rounded-lg px-3 py-1 text-center font-display text-lg font-bold tabular-nums ${
              clock.running
                ? clock.ms < 20_000
                  ? "bg-[#F87171] text-[#2A0707]"
                  : "bg-[#F4F6FF] text-ink-dark"
                : "bg-card-2 text-muted"
            }`}
          >
            {formatClock(clock.ms)}
          </span>
        )}
      </div>
    </div>
  );
}

export function SelectedPanel({
  game,
  selected,
  moves,
}: {
  game: GameState;
  selected: Square | null;
  moves: Move[];
}) {
  const piece = selected !== null ? game.board[selected] : null;
  if (!piece || selected === null) {
    return (
      <section aria-label="Selected Pokémon" className={`${card} p-5 text-sm text-muted`}>
        Select one of your pieces to see its Pokémon, its legal moves, and how effective each attack
        would be.
      </section>
    );
  }
  const targets = moves
    .filter((m) => m.defender !== undefined)
    .map((m) => {
      const d = game.board[m.defender as Square];
      return d ? { m, d, eff: effectiveness(piece.type, d.type) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.eff - a.eff);

  return (
    <section aria-label="Selected Pokémon" className={`${card} flex flex-col gap-4 p-5`}>
      <div className="flex items-center gap-4">
        <div className="relative flex h-28 w-28 shrink-0 items-end justify-center rounded-2xl border border-line bg-card-2">
          <span
            className="platform platform-white"
            style={{
              left: 14,
              bottom: 12,
              width: 82,
              height: 22,
              ["--type" as string]: TYPE_COLOR[piece.type],
            }}
          />
          <span className="relative mb-2">
            <Sprite species={piece.species} type={piece.type} size={96} />
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="font-display text-2xl font-bold tracking-tight">{piece.species}</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <TypeChip type={piece.type} />
            <span className="inline-flex items-center gap-1 rounded-md border border-line bg-card-2 py-0.5 pl-1 pr-2 text-xs font-semibold">
              <PieceIcon role={piece.role} color={piece.color} size={16} />
              {ROLE_NAME[piece.role]}
            </span>
            <span className="rounded-md border border-line bg-card-2 px-2 py-0.5 text-xs font-semibold">
              {squareName(selected)}
            </span>
            <span className="text-xs text-muted">{moves.length} legal moves</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Attack preview · {targets.length} {targets.length === 1 ? "target" : "targets"}
          </h3>
          <span className="text-xs text-muted">10% dodge on every attack</span>
        </div>
        {targets.length === 0 && (
          <p className="text-sm text-muted">No pieces to attack from here.</p>
        )}
        {targets.map(({ m, d, eff }) => (
          <div key={m.to} className="flex items-center gap-3 rounded-xl bg-card-2 px-3 py-2.5">
            <span
              className="flex h-8 w-11 shrink-0 items-center justify-center rounded-lg font-display text-[15px] font-bold"
              style={
                eff === 0
                  ? { border: "1.5px dashed #9AA6C8", color: "#CBD5E1" }
                  : { background: EFFECT_STYLE[eff].bg, color: EFFECT_STYLE[eff].fg }
              }
            >
              {EFFECT_STYLE[eff].label}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold">{d.species}</span>
              <span className="text-xs text-muted">
                {d.type} · {ROLE_NAME[d.role]} · {squareName(m.defender as Square)}
              </span>
            </div>
            <span className="text-right text-[13px] font-medium">{EFFECT_RESULT[eff]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const TAG_STYLE: Record<LogTag, [string, string]> = {
  MOVE: ["#26305A", "#E8ECF8"],
  "2×": ["#34D399", "#06281C"],
  CRIT: ["#FBBF24", "#1A1405"],
  KO: ["#CBD5E1", "#0B1020"],
  "½×": ["#FB923C", "#2A1204"],
  "0×": ["#334155", "#E2E8F0"],
  DODGE: ["#2DD4BF", "#042F2B"],
  PROMO: ["#A98FF3", "#160A33"],
  BONUS: ["#FBBF24", "#1A1405"],
  END: ["#6EA8FE", "#0B1020"],
};

const sideName = (e: LogEntry) => (e.color === "white" ? "White" : "Black");
const spoken = (e: LogEntry) => (e.color ? `${sideName(e)}: ${e.text}` : e.text);

function LogLine({ e }: { e: LogEntry }) {
  return (
    <>
      <span
        className="w-[52px] shrink-0 rounded-md py-0.5 text-center text-[11px] font-bold tracking-wide"
        style={{ background: TAG_STYLE[e.tag][0], color: TAG_STYLE[e.tag][1] }}
      >
        {e.tag}
      </span>
      <span className={`text-[13px] leading-snug ${e.tag === "MOVE" ? "text-muted" : ""}`}>
        {e.color && <span className="font-semibold">{sideName(e)}: </span>}
        {e.text}
      </span>
    </>
  );
}

/**
 * Newest-first log of every action. Below the md breakpoint (where this panel stacks under the
 * board) it collapses to the newest entry with a "Show all" toggle, so the controls under it stay
 * close to the board. Announcements go through a separate live region that is never hidden.
 */
export function BattleLog({ log }: { log: LogEntry[] }) {
  const [open, setOpen] = useState(false);
  const latest = log[0];
  const canToggle = log.length > 1;

  // Announce only the entries one action added (a battle can add several), oldest first.
  const seen = useRef(0);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (!latest) {
      seen.current = 0;
      setAnnouncement("");
      return;
    }
    const fresh = log.filter((e) => e.id > seen.current);
    seen.current = latest.id;
    if (fresh.length > 0) setAnnouncement(fresh.reverse().map(spoken).join(" "));
  }, [log, latest]);

  return (
    <section aria-label="Battle log" className={`${card} flex min-h-0 flex-col gap-3 p-5`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-[17px] font-semibold">Battle log</h3>
        <span className="hidden text-xs text-muted md:inline">newest first</span>
        {canToggle && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls="battle-log-entries"
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg border border-line bg-card-2 px-3 py-1.5 text-xs font-semibold md:hidden"
          >
            {open ? "Show less" : `Show all (${log.length})`}
          </button>
        )}
      </div>

      {!open && (
        <div className="flex items-start gap-2.5 md:hidden">
          {latest ? (
            <LogLine e={latest} />
          ) : (
            <span className="text-sm text-muted">White moves first. Good luck!</span>
          )}
        </div>
      )}

      <ol
        id="battle-log-entries"
        className={`${open ? "flex" : "hidden"} max-h-72 flex-col gap-2.5 overflow-y-auto pr-1 md:flex`}
      >
        {log.length === 0 && <li className="text-sm text-muted">White moves first. Good luck!</li>}
        {log.map((e) => (
          <li key={e.id} className="flex items-start gap-2.5">
            <LogLine e={e} />
          </li>
        ))}
      </ol>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </section>
  );
}

const BANNER_STYLE: Record<Banner["outcome"], { label: string; color: string }> = {
  superEffective: { label: "2×", color: "#34D399" },
  crit: { label: "CRIT", color: "#FBBF24" },
  captured: { label: "1×", color: "#E8ECF8" },
  resisted: { label: "½×", color: "#FB923C" },
  immune: { label: "0×", color: "#CBD5E1" },
  dodged: { label: "DODGE", color: "#2DD4BF" },
};

export function OutcomeBanner({ banner, onDone }: { banner: Banner | null; onDone: () => void }) {
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!banner) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(onDone, 1500);
    return () => window.clearTimeout(timer.current);
  }, [banner, onDone]);
  if (!banner) return null;
  const s = BANNER_STYLE[banner.outcome];
  return (
    <div
      key={banner.id}
      className="banner pointer-events-none absolute inset-x-0 top-1/2 z-20 flex justify-center"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-[#0E1428]/95 px-5 py-3 shadow-2xl">
        <span
          className="rounded-lg px-2 py-1 font-display text-sm font-bold"
          style={{ background: s.color, color: "#0B1020" }}
        >
          {s.label}
        </span>
        <div className="flex flex-col">
          <span className="font-display text-xl font-bold" style={{ color: s.color }}>
            {banner.title}
          </span>
          <span className="text-sm">{banner.line}</span>
        </div>
      </div>
    </div>
  );
}

const PROMO: Role[] = ["queen", "rook", "bishop", "knight"];

export function PromotionDialog({
  open,
  onPick,
  onCancel,
}: {
  open: boolean;
  onPick: (r: Role) => void;
  onCancel: () => void;
}) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) first.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="promo-title"
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4"
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <div className={`${card} flex flex-col gap-4 p-6`}>
        <h2 id="promo-title" className="font-display text-xl font-bold">
          Promote your pawn
        </h2>
        <p className="text-sm text-muted">
          It keeps its Pokémon and type. Applies only if the pawn lands.
        </p>
        <div className="grid grid-cols-4 gap-3">
          {PROMO.map((r, i) => (
            <button
              key={r}
              ref={i === 0 ? first : undefined}
              type="button"
              onClick={() => onPick(r)}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-card-2 hover:border-accent"
            >
              <PieceIcon role={r} color="white" size={36} />
              <span className="text-xs font-semibold">{ROLE_NAME[r]}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={onCancel} className="self-end text-sm text-muted underline">
          Cancel
        </button>
      </div>
    </div>
  );
}

export function GameOverDialog({
  game,
  stats,
  onNewGame,
  onClose,
  newGameLabel = "New game",
}: {
  game: GameState;
  stats: Record<Color, Stats>;
  onNewGame: () => void;
  onClose: () => void;
  newGameLabel?: string;
}) {
  if (game.status.state === "active") return null;
  const s = game.status;
  const title = s.state === "won" ? `${s.winner === "white" ? "White" : "Black"} wins!` : "Draw";
  const reason =
    s.state === "won"
      ? {
          kingCaptured: "King captured",
          resignation: "Resignation",
          timeout: "Timeout",
          abandonment: "Abandonment",
        }[s.reason]
      : {
          stalemate: "Stalemate",
          agreement: "Agreed draw",
          halfMoveLimit: "100 half-move rule",
          doubleKnockout: "Double knockout",
        }[s.reason];
  const rows: [string, keyof Stats][] = [
    ["Captures", "captures"],
    ["Super-effective hits", "superEffective"],
    ["Critical hits", "crits"],
    ["Dodges", "dodges"],
  ];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="over-title"
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4"
    >
      <div className={`${card} flex w-full max-w-md flex-col gap-5 p-6`}>
        <div>
          <h2 id="over-title" className="font-display text-3xl font-bold">
            {title}
          </h2>
          <p className="text-sm text-muted">{reason}</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted">
              <th className="py-1 font-semibold">Stat</th>
              <th className="py-1 text-right font-semibold">White</th>
              <th className="py-1 text-right font-semibold">Black</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, key]) => (
              <tr key={key} className="border-t border-line">
                <td className="py-1.5">{label}</td>
                <td className="py-1.5 text-right tabular-nums">{stats.white[key]}</td>
                <td className="py-1.5 text-right tabular-nums">{stats.black[key]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onNewGame}
            className="h-12 flex-1 rounded-xl bg-accent font-semibold text-ink-dark"
          >
            {newGameLabel}
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
  );
}
