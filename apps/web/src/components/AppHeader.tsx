import type { ReactNode } from "react";

/** Logo, title, an optional context badge and screen-specific controls on the right. */
export function AppHeader({ badge, children }: { badge?: string; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-2 bg-[#0E1428] px-4 py-3 sm:px-8">
      <div className="flex items-center gap-4">
        <a href="/" className="flex items-center gap-4" aria-label="Pokémon Chess home">
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
            <rect width="14" height="14" rx="3" fill="#6EA8FE" />
            <rect x="14" y="14" width="14" height="14" rx="3" fill="#6EA8FE" />
            <rect x="14" width="14" height="14" rx="3" fill="#26305A" />
            <rect y="14" width="14" height="14" rx="3" fill="#26305A" />
          </svg>
          <span className="font-display text-xl font-bold tracking-tight">Pokémon Chess</span>
        </a>
        {badge && (
          <span className="hidden rounded-full border border-line bg-card px-3 py-1 text-[13px] text-muted sm:inline">
            {badge}
          </span>
        )}
      </div>
      {children && (
        <nav className="flex items-center gap-2" aria-label="Game controls">
          {children}
        </nav>
      )}
    </header>
  );
}
