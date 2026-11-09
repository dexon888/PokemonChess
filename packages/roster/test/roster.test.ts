import { POKEMON_TYPES } from "@pokemon-chess/engine";
import { describe, expect, it } from "vitest";
import { ROSTER_V1, rosterEntry } from "../src/index.js";

describe("roster v1", () => {
  it("covers all 1025 species plus regional forms (R14)", () => {
    expect(new Set(ROSTER_V1.map((p) => p.num)).size).toBe(1025);
    expect(rosterEntry("Ninetales-Alola")).toBeDefined();
    expect(rosterEntry("Charizard-Mega-X")).toBeUndefined();
    expect(rosterEntry("Darmanitan-Galar-Zen")).toBeUndefined();
    expect(ROSTER_V1.some((p) => p.name.includes("Totem") || p.name.includes("Gmax"))).toBe(false);
  });

  it("every entry has unique names, 1–2 valid types and a static sprite", () => {
    expect(new Set(ROSTER_V1.map((p) => p.name)).size).toBe(ROSTER_V1.length);
    for (const p of ROSTER_V1) {
      expect(p.types.length).toBeGreaterThanOrEqual(1);
      expect(p.types.length).toBeLessThanOrEqual(2);
      for (const t of p.types) expect(POKEMON_TYPES).toContain(t);
      expect(p.sprite.static).toMatch(/^https:\/\/.+\.png$/);
    }
  });
});
