import type { Effectiveness, PokemonType, Role } from "@pokemon-chess/engine";

export const TYPE_COLOR: Record<PokemonType, string> = {
  Normal: "#A8A77A",
  Fire: "#EE8130",
  Water: "#6390F0",
  Electric: "#F7D02C",
  Grass: "#7AC74C",
  Ice: "#96D9D6",
  Fighting: "#C22E28",
  Poison: "#A33EA1",
  Ground: "#E2BF65",
  Flying: "#A98FF3",
  Psychic: "#F95587",
  Bug: "#A6B91A",
  Rock: "#B6A136",
  Ghost: "#735797",
  Dragon: "#6F35FC",
  Dark: "#705746",
  Steel: "#B7B7CE",
  Fairy: "#D685AD",
};

const LIGHT_TEXT = new Set<PokemonType>(["Fighting", "Poison", "Ghost", "Dragon", "Dark"]);

/** Text colour with at least 5.5:1 contrast on the type colour. */
export const typeTextColor = (t: PokemonType) => (LIGHT_TEXT.has(t) ? "#FFFFFF" : "#10131F");

export const typeCode = (t: PokemonType) => t.slice(0, 3).toUpperCase();

/** Glyphs with U+FE0E so they never render as emoji. */
export const ROLE_GLYPH: Record<Role, string> = {
  king: "♚︎",
  queen: "♛︎",
  rook: "♜︎",
  bishop: "♝︎",
  knight: "♞︎",
  pawn: "♟︎",
};

export const ROLE_NAME: Record<Role, string> = {
  king: "King",
  queen: "Queen",
  rook: "Rook",
  bishop: "Bishop",
  knight: "Knight",
  pawn: "Pawn",
};

export const EFFECT_STYLE: Record<Effectiveness, { label: string; bg: string; fg: string }> = {
  2: { label: "2×", bg: "#34D399", fg: "#06281C" },
  1: { label: "1×", bg: "#CBD5E1", fg: "#0B1020" },
  0.5: { label: "½×", bg: "#FBBF24", fg: "#1A1405" },
  0: { label: "0×", bg: "#94A3B8", fg: "#0B1020" },
};

export const EFFECT_RESULT: Record<Effectiveness, string> = {
  2: "Captures + bonus turn",
  1: "Captures · 10% crit",
  0.5: "Both faint",
  0: "No effect · turn ends",
};
