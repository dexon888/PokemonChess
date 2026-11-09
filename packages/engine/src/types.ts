/** The 18 types of the Generation 6+ type chart (decision R15). */
export const POKEMON_TYPES = [
  "Normal",
  "Fire",
  "Water",
  "Electric",
  "Grass",
  "Ice",
  "Fighting",
  "Poison",
  "Ground",
  "Flying",
  "Psychic",
  "Bug",
  "Rock",
  "Ghost",
  "Dragon",
  "Dark",
  "Steel",
  "Fairy",
] as const;

export type PokemonType = (typeof POKEMON_TYPES)[number];

export type Color = "white" | "black";

export type Role = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";

/** Damage multiplier of one type attacking another. */
export type Effectiveness = 0 | 0.5 | 1 | 2;
