import { useSyncExternalStore } from "react";

/** Per-device audio preferences (PRD 7.3). Music joins these with the king-threat step. */
export interface AudioSettings {
  /** Sound effects on or off. */
  sfx: boolean;
  /** Master volume, 0–1. */
  volume: number;
}

const KEY = "pc.audio";
const DEFAULTS: AudioSettings = { sfx: true, volume: 0.6 };

function read(): AudioSettings {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const s = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      sfx: typeof s.sfx === "boolean" ? s.sfx : DEFAULTS.sfx,
      volume:
        typeof s.volume === "number" && s.volume >= 0 && s.volume <= 1 ? s.volume : DEFAULTS.volume,
    };
  } catch {
    return DEFAULTS;
  }
}

let current: AudioSettings = read();
const listeners = new Set<() => void>();

export function audioSettings(): AudioSettings {
  return current;
}

export function setAudioSettings(patch: Partial<AudioSettings>) {
  current = { ...current, ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Storage blocked: the setting still applies until the page closes.
  }
  for (const l of listeners) l();
}

export function useAudioSettings(): AudioSettings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
