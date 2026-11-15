import { audioSettings } from "./settings";

/** Every sound effect the game plays (PRD 7.1). */
export type Sfx =
  | "move"
  | "capture"
  | "superEffective"
  | "notVeryEffective"
  | "critical"
  | "dodge"
  | "immune"
  | "victory"
  | "defeat";

/** File names in `public/sfx/` (see the README there). */
export const SFX_FILE: Record<Sfx, string> = {
  move: "move",
  capture: "capture",
  superEffective: "super-effective",
  notVeryEffective: "not-very-effective",
  critical: "critical",
  dodge: "dodge",
  immune: "immune",
  victory: "victory",
  defeat: "defeat",
};

const EXTENSIONS = ["mp3", "ogg", "wav"];

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
/** A decoded local file per sound, or null when it falls back to the synthesized version. */
const buffers = new Map<Sfx, AudioBuffer | null>();

/**
 * Browsers only allow audio after a user gesture, so the engine starts on the first tap or key
 * press. It then looks for local files (D9) once; anything missing is synthesized.
 */
function unlock() {
  if (ctx) {
    void ctx.resume();
    return;
  }
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  ctx = new Ctor();
  master = ctx.createGain();
  master.connect(ctx.destination);
  void loadLocalFiles(ctx);
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", unlock, { capture: true });
  window.addEventListener("keydown", unlock, { capture: true });
}

async function loadLocalFiles(audio: AudioContext) {
  await Promise.all(
    (Object.keys(SFX_FILE) as Sfx[]).map(async (name) => {
      buffers.set(name, await loadOne(audio, SFX_FILE[name]));
    }),
  );
}

async function loadOne(audio: AudioContext, base: string): Promise<AudioBuffer | null> {
  for (const ext of EXTENSIONS) {
    try {
      const res = await fetch(`/sfx/${base}.${ext}`);
      // A missing file comes back as the app's HTML page, not a 404, so check the type.
      if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("audio/")) continue;
      return await audio.decodeAudioData(await res.arrayBuffer());
    } catch {
      // Not decodable: try the next extension.
    }
  }
  return null;
}

/** Whether a local file (rather than the synthesized sound) will play for `name`. */
export function usesLocalFile(name: Sfx): boolean {
  return !!buffers.get(name);
}

/** Plays a sound after `delayMs` (to land with the battle effect). Silent until unlocked. */
export function playSfx(name: Sfx, delayMs = 0) {
  const settings = audioSettings();
  if (!ctx || !master || !settings.sfx || settings.volume <= 0) return;
  master.gain.value = settings.volume;
  const when = ctx.currentTime + delayMs / 1000;
  const buffer = buffers.get(name);
  if (buffer) {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(master);
    src.start(when);
    return;
  }
  SYNTH[name](ctx, master, when);
}

// --- Synthesized fallbacks: original sounds, built from oscillators and noise. ---

type Synth = (ctx: AudioContext, out: AudioNode, t: number) => void;

/** A tone with a fast attack and an exponential decay. */
function tone(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  opts: { type: OscillatorType; from: number; to?: number; dur: number; gain: number },
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = opts.type;
  osc.frequency.setValueAtTime(opts.from, t);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + opts.dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + opts.dur + 0.02);
}

let noiseBuffer: AudioBuffer | null = null;
/** A burst of filtered white noise: the "impact" in hits, the "air" in a whoosh. */
function noise(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  opts: {
    dur: number;
    gain: number;
    filter: BiquadFilterType;
    from: number;
    to?: number;
    q?: number;
  },
) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    // Fixed pseudo-random noise (no Math.random): a simple LCG is plenty for audio.
    let seed = 1;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = seed / 2147483648 - 1;
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = opts.filter;
  filter.Q.value = opts.q ?? 1;
  filter.frequency.setValueAtTime(opts.from, t);
  if (opts.to) filter.frequency.exponentialRampToValueAtTime(opts.to, t + opts.dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(opts.gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
  src.connect(filter).connect(g).connect(out);
  src.start(t);
  src.stop(t + opts.dur + 0.02);
}

const SYNTH: Record<Sfx, Synth> = {
  // A soft wooden "tok".
  move: (c, o, t) => tone(c, o, t, { type: "triangle", from: 540, to: 380, dur: 0.07, gain: 0.25 }),
  // A solid hit: a noise crack over a low thump.
  capture: (c, o, t) => {
    noise(c, o, t, { dur: 0.12, gain: 0.5, filter: "bandpass", from: 1400, q: 0.8 });
    tone(c, o, t, { type: "sine", from: 180, to: 70, dur: 0.18, gain: 0.6 });
  },
  // Two quick hits, the second brighter, with a rising "pop" on top: reads as a big hit.
  superEffective: (c, o, t) => {
    noise(c, o, t, { dur: 0.09, gain: 0.55, filter: "bandpass", from: 1600, q: 0.8 });
    tone(c, o, t, { type: "square", from: 220, to: 110, dur: 0.1, gain: 0.25 });
    noise(c, o, t + 0.09, { dur: 0.12, gain: 0.6, filter: "bandpass", from: 2600, q: 0.8 });
    tone(c, o, t + 0.09, { type: "square", from: 330, to: 140, dur: 0.12, gain: 0.25 });
    tone(c, o, t + 0.12, { type: "triangle", from: 700, to: 1500, dur: 0.18, gain: 0.3 });
  },
  // A muffled, low, short thud: feels weak.
  notVeryEffective: (c, o, t) => {
    noise(c, o, t, { dur: 0.16, gain: 0.35, filter: "lowpass", from: 600, to: 200 });
    tone(c, o, t, { type: "sine", from: 120, to: 60, dur: 0.22, gain: 0.5 });
  },
  // A hard hit with a high sparkle.
  critical: (c, o, t) => {
    noise(c, o, t, { dur: 0.14, gain: 0.65, filter: "bandpass", from: 2000, q: 0.7 });
    tone(c, o, t, { type: "sawtooth", from: 260, to: 90, dur: 0.16, gain: 0.25 });
    tone(c, o, t + 0.05, { type: "triangle", from: 1800, to: 2700, dur: 0.16, gain: 0.25 });
    tone(c, o, t + 0.11, { type: "triangle", from: 2400, to: 3200, dur: 0.12, gain: 0.18 });
  },
  // A quick whoosh.
  dodge: (c, o, t) =>
    noise(c, o, t, { dur: 0.26, gain: 0.4, filter: "bandpass", from: 400, to: 2600, q: 2 }),
  // A hollow "tink" off a shield.
  immune: (c, o, t) => {
    tone(c, o, t, { type: "sine", from: 1320, dur: 0.25, gain: 0.25 });
    tone(c, o, t, { type: "sine", from: 1980, dur: 0.18, gain: 0.15 });
    tone(c, o, t, { type: "triangle", from: 260, to: 200, dur: 0.08, gain: 0.2 });
  },
  // A rising arpeggio.
  victory: (c, o, t) =>
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(c, o, t + i * 0.11, { type: "triangle", from: f, dur: i === 3 ? 0.4 : 0.14, gain: 0.3 }),
    ),
  // A slow falling line.
  defeat: (c, o, t) =>
    [392, 330, 262].forEach((f, i) =>
      tone(c, o, t + i * 0.18, { type: "triangle", from: f, dur: i === 2 ? 0.5 : 0.2, gain: 0.3 }),
    ),
};
