import { describe, expect, it } from "vitest";
import { createScriptedRng, createSeededRng, resolveBattle } from "../src/index.js";

// Rolls below 0.1 hit (dodge or crit); 0.5 always misses.
const HIT = 0.05;
const MISS = 0.5;

describe("resolveBattle", () => {
  it("immunity wins before any roll is consumed (R3)", () => {
    const r = resolveBattle("Fighting", "Ghost", createScriptedRng([]));
    expect(r.outcome).toBe("immune");
    expect(r.rolls).toEqual([]);
    expect(r).toMatchObject({
      bonusTurn: false,
      attackerRemoved: false,
      defenderRemoved: false,
      attackerMoves: false,
    });
  });

  it("a dodge cancels the capture regardless of effectiveness", () => {
    for (const defender of ["Rock", "Dragon", "Flying"] as const) {
      const r = resolveBattle("Fighting", defender, createScriptedRng([HIT]));
      expect(r.outcome).toBe("dodged");
      expect(r).toMatchObject({ defenderRemoved: false, attackerMoves: false, bonusTurn: false });
    }
  });

  it("super effective captures and grants a bonus turn, with no crit roll", () => {
    const r = resolveBattle("Fighting", "Rock", createScriptedRng([MISS]));
    expect(r.outcome).toBe("superEffective");
    expect(r.rolls).toHaveLength(1);
    expect(r).toMatchObject({
      bonusTurn: true,
      crit: false,
      defenderRemoved: true,
      attackerMoves: true,
    });
  });

  it("not very effective removes both pieces and ends the turn", () => {
    const r = resolveBattle("Fighting", "Flying", createScriptedRng([MISS]));
    expect(r.outcome).toBe("resisted");
    expect(r).toMatchObject({ attackerRemoved: true, defenderRemoved: true, bonusTurn: false });
  });

  it("normal effectiveness captures; a crit grants a bonus turn", () => {
    const plain = resolveBattle("Fighting", "Dragon", createScriptedRng([MISS, MISS]));
    expect(plain).toMatchObject({ outcome: "captured", crit: false, bonusTurn: false });

    const crit = resolveBattle("Fighting", "Dragon", createScriptedRng([MISS, HIT]));
    expect(crit).toMatchObject({ outcome: "captured", crit: true, bonusTurn: true });
    expect(crit.rolls.map((x) => x.kind)).toEqual(["dodge", "crit"]);
  });

  it("respects configured probabilities", () => {
    const r = resolveBattle("Fighting", "Dragon", createScriptedRng([HIT, MISS]), {
      dodgeChance: 0,
      critChance: 1,
    });
    expect(r).toMatchObject({ outcome: "captured", crit: true });
  });

  it("seeded RNG is reproducible and lands near 10% dodge over many attacks", () => {
    const run = (seed: number) => {
      const rng = createSeededRng(seed);
      return Array.from({ length: 20_000 }, () => resolveBattle("Fire", "Grass", rng).outcome);
    };
    const a = run(42);
    expect(run(42)).toEqual(a);
    const dodgeRate = a.filter((o) => o === "dodged").length / a.length;
    expect(dodgeRate).toBeGreaterThan(0.09);
    expect(dodgeRate).toBeLessThan(0.11);
  });
});
