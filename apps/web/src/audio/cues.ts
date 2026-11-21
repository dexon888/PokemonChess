import type { Color, GameEvent } from "@pokemon-chess/engine";
import type { Sfx } from "./sfx";

/** When a sound plays: with the move, when the hit lands, or after it for the game's end. */
export type CueTiming = "now" | "impact" | "end";

export interface Cue {
  sfx: Sfx;
  at: CueTiming;
}

/**
 * Which sounds one action's events should play (PRD 7.1). Pure, like `narrate`.
 *
 * `listener` is whose ears these are: online it is your colour, so a win sounds like victory
 * and a loss like defeat; in a hot-seat game (or for a spectator) any win plays victory.
 */
export function soundsFor(events: GameEvent[], listener: Color | null): Cue[] {
  const cues: Cue[] = [];
  let battle = false;
  for (const e of events) {
    if (e.type === "battle") {
      battle = true;
      const r = e.result;
      const sfx: Sfx =
        r.outcome === "superEffective"
          ? "superEffective"
          : r.outcome === "resisted"
            ? "notVeryEffective"
            : r.outcome === "dodged"
              ? "dodge"
              : r.outcome === "immune"
                ? "immune"
                : r.crit
                  ? "critical"
                  : "capture";
      cues.push({ sfx, at: "impact" });
    }
  }
  if (!battle && events.some((e) => e.type === "move" || e.type === "castle")) {
    cues.push({ sfx: "move", at: "now" });
  }
  const over = events.find((e) => e.type === "gameOver");
  if (over?.type === "gameOver" && over.status.state === "won") {
    const won = listener === null || over.status.winner === listener;
    cues.push({ sfx: won ? "victory" : "defeat", at: "end" });
  }
  return cues;
}
