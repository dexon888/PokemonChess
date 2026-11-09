import type { RosterEntry } from "@pokemon-chess/engine";

export interface RosterPokemon extends RosterEntry {
  num: number;
  sprite: {
    /** Animated pixel sprite (GIF), when one exists. */
    animated: string | null;
    /** Static pixel sprite (PNG), always present. */
    static: string;
  };
}
