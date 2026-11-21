import { useEffect, useId, useRef, useState } from "react";
import { setAudioSettings, useAudioSettings } from "../audio/settings";
import { playSfx } from "../audio/sfx";

/** Header button with the audio settings (PRD 7.3): sound effects on/off and volume. */
export function SoundControl() {
  const s = useAudioSettings();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const muted = !s.sfx || s.volume === 0;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className="btn"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Sound settings (${muted ? "muted" : `on, volume ${Math.round(s.volume * 100)}%`})`}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none">
          <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
          {muted ? (
            <path
              d="M16 9l5 6m0-6l-5 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
        </svg>
      </button>
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label="Sound settings"
          className="absolute right-0 top-full z-40 mt-2 flex w-64 flex-col gap-4 rounded-xl border border-line bg-card p-4 shadow-2xl"
        >
          <label className="flex items-center justify-between gap-3 text-sm font-semibold">
            Sound effects
            <input
              type="checkbox"
              role="switch"
              checked={s.sfx}
              onChange={(e) => {
                setAudioSettings({ sfx: e.target.checked });
                if (e.target.checked) playSfx("move");
              }}
              className="h-5 w-5 accent-accent"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            <span className="flex justify-between">
              Volume <span className="text-muted">{Math.round(s.volume * 100)}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(s.volume * 100)}
              disabled={!s.sfx}
              onChange={(e) => setAudioSettings({ volume: Number(e.target.value) / 100 })}
              onPointerUp={() => playSfx("capture")}
              onKeyUp={() => playSfx("capture")}
              className="accent-accent"
            />
          </label>
          <p className="text-xs text-muted">
            Your own sound files in <code>public/sfx</code> replace the built-in sounds.
          </p>
        </div>
      )}
    </div>
  );
}
