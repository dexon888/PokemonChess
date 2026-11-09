import { Dex } from "@pkmn/dex";
import { describe, expect, it } from "vitest";
import { effectiveness, POKEMON_TYPES } from "../src/index.js";

describe("type chart", () => {
  it("matches the Gen 9 chart from @pkmn/dex for all 324 pairings", () => {
    const gen9 = Dex.forGen(9);
    // damageTaken codes: 0 = normal, 1 = weak (2×), 2 = resists (½×), 3 = immune (0×)
    const fromCode = { 0: 1, 1: 2, 2: 0.5, 3: 0 } as const;
    for (const attacker of POKEMON_TYPES) {
      for (const defender of POKEMON_TYPES) {
        const code = gen9.types.get(defender).damageTaken[attacker] as 0 | 1 | 2 | 3;
        expect(effectiveness(attacker, defender), `${attacker} → ${defender}`).toBe(fromCode[code]);
      }
    }
  });

  it("has 51 super-effective, 61 resisted and 8 immune pairings", () => {
    const counts = { 2: 0, 0.5: 0, 0: 0 };
    for (const a of POKEMON_TYPES)
      for (const d of POKEMON_TYPES) {
        const e = effectiveness(a, d);
        if (e !== 1) counts[e]++;
      }
    expect(counts).toEqual({ 2: 51, 0.5: 61, 0: 8 });
  });

  it("covers the matchups shown in the game screen design", () => {
    expect(effectiveness("Fighting", "Rock")).toBe(2);
    expect(effectiveness("Fighting", "Dragon")).toBe(1);
    expect(effectiveness("Fighting", "Flying")).toBe(0.5);
    expect(effectiveness("Fighting", "Ghost")).toBe(0);
  });
});
