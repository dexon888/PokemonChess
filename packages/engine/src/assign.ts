import { createStartingPosition, type LayoutEntry, type Position } from "./board.js";
import type { Rng } from "./rng.js";
import type { PokemonType } from "./types.js";

export interface RosterEntry {
  id: string;
  name: string;
  types: readonly [PokemonType] | readonly [PokemonType, PokemonType];
}

const pick = <T>(items: readonly T[], rng: Rng): T => {
  const item = items[Math.floor(rng.next() * items.length)];
  if (item === undefined) throw new Error("Cannot pick from an empty list");
  return item;
};

/**
 * Starting position with an independent random Pokémon per piece (PRD 2.3). Duplicates are
 * allowed; a dual-type Pokémon gets one of its types at 50/50 (PRD 2.4).
 */
export function createRandomStartingPosition(roster: readonly RosterEntry[], rng: Rng): Position {
  return createStartingPosition((_entry: LayoutEntry) => {
    const mon = pick(roster, rng);
    return { species: mon.name, type: pick(mon.types, rng) };
  });
}
