import type { Effectiveness, PokemonType } from "./types.js";

type Matchups = { super?: PokemonType[]; resisted?: PokemonType[]; immune?: PokemonType[] };

/**
 * Generation 6+ type chart, keyed by ATTACKING type.
 * Any pairing not listed is 1×. Verified against @pkmn/dex Gen 9 data in tests.
 */
const CHART: Record<PokemonType, Matchups> = {
  Normal: { resisted: ["Rock", "Steel"], immune: ["Ghost"] },
  Fire: {
    super: ["Grass", "Ice", "Bug", "Steel"],
    resisted: ["Fire", "Water", "Rock", "Dragon"],
  },
  Water: { super: ["Fire", "Ground", "Rock"], resisted: ["Water", "Grass", "Dragon"] },
  Electric: {
    super: ["Water", "Flying"],
    resisted: ["Electric", "Grass", "Dragon"],
    immune: ["Ground"],
  },
  Grass: {
    super: ["Water", "Ground", "Rock"],
    resisted: ["Fire", "Grass", "Poison", "Flying", "Bug", "Dragon", "Steel"],
  },
  Ice: {
    super: ["Grass", "Ground", "Flying", "Dragon"],
    resisted: ["Fire", "Water", "Ice", "Steel"],
  },
  Fighting: {
    super: ["Normal", "Ice", "Rock", "Dark", "Steel"],
    resisted: ["Poison", "Flying", "Psychic", "Bug", "Fairy"],
    immune: ["Ghost"],
  },
  Poison: {
    super: ["Grass", "Fairy"],
    resisted: ["Poison", "Ground", "Rock", "Ghost"],
    immune: ["Steel"],
  },
  Ground: {
    super: ["Fire", "Electric", "Poison", "Rock", "Steel"],
    resisted: ["Grass", "Bug"],
    immune: ["Flying"],
  },
  Flying: { super: ["Grass", "Fighting", "Bug"], resisted: ["Electric", "Rock", "Steel"] },
  Psychic: { super: ["Fighting", "Poison"], resisted: ["Psychic", "Steel"], immune: ["Dark"] },
  Bug: {
    super: ["Grass", "Psychic", "Dark"],
    resisted: ["Fire", "Fighting", "Poison", "Flying", "Ghost", "Steel", "Fairy"],
  },
  Rock: { super: ["Fire", "Ice", "Flying", "Bug"], resisted: ["Fighting", "Ground", "Steel"] },
  Ghost: { super: ["Psychic", "Ghost"], resisted: ["Dark"], immune: ["Normal"] },
  Dragon: { super: ["Dragon"], resisted: ["Steel"], immune: ["Fairy"] },
  Dark: { super: ["Psychic", "Ghost"], resisted: ["Fighting", "Dark", "Fairy"] },
  Steel: {
    super: ["Ice", "Rock", "Fairy"],
    resisted: ["Fire", "Water", "Electric", "Steel"],
  },
  Fairy: { super: ["Fighting", "Dragon", "Dark"], resisted: ["Fire", "Poison", "Steel"] },
};

/** Multiplier when `attacker`'s active type attacks `defender`'s active type. */
export function effectiveness(attacker: PokemonType, defender: PokemonType): Effectiveness {
  const m = CHART[attacker];
  if (m.immune?.includes(defender)) return 0;
  if (m.super?.includes(defender)) return 2;
  if (m.resisted?.includes(defender)) return 0.5;
  return 1;
}
