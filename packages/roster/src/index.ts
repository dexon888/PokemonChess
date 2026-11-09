import { ROSTER_V1 } from "./roster.v1.js";
import type { RosterPokemon } from "./types.js";

export { ROSTER_V1, ROSTER_VERSION } from "./roster.v1.js";
export type { RosterPokemon } from "./types.js";

const BY_NAME = new Map(ROSTER_V1.map((p) => [p.name, p]));

/** Looks up a roster entry by species name (as stored on engine pieces). */
export function rosterEntry(name: string): RosterPokemon | undefined {
  return BY_NAME.get(name);
}
