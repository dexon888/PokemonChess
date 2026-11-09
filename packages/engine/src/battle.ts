import type { Rng } from "./rng.js";
import { effectiveness } from "./typechart.js";
import type { Effectiveness, PokemonType } from "./types.js";

export interface BattleConfig {
  /** Chance an attempted capture is dodged (PRD 3.2). */
  dodgeChance: number;
  /** Chance a normal-effectiveness capture is a critical hit (PRD 3.1). */
  critChance: number;
}

export const DEFAULT_BATTLE_CONFIG: BattleConfig = { dodgeChance: 0.1, critChance: 0.1 };

export type BattleOutcome =
  | "immune" // 0×: nothing happens, turn ends
  | "dodged" // nothing happens, turn ends
  | "superEffective" // 2×: defender removed, attacker advances, bonus turn
  | "captured" // 1×: defender removed, attacker advances (bonus turn if crit)
  | "resisted"; // ½×: both pieces removed, turn ends

export interface BattleRoll {
  kind: "dodge" | "crit";
  value: number;
  hit: boolean;
}

export interface BattleResult {
  outcome: BattleOutcome;
  effectiveness: Effectiveness;
  crit: boolean;
  bonusTurn: boolean;
  attackerRemoved: boolean;
  defenderRemoved: boolean;
  /** True when the attacker ends on the defender's (or en passant target) square. */
  attackerMoves: boolean;
  /** Every roll consumed, in order. Stored in the match log so outcomes are never re-rolled. */
  rolls: BattleRoll[];
}

/**
 * Resolves one capture attempt. Order (PRD 3.3, amended by decision R3):
 * 1. Immunity is checked first and consumes no roll.
 * 2. Dodge roll.
 * 3. Effectiveness: 2× captures with a bonus turn; ½× removes both; 1× rolls for a crit.
 */
export function resolveBattle(
  attacker: PokemonType,
  defender: PokemonType,
  rng: Rng,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG,
): BattleResult {
  const eff = effectiveness(attacker, defender);
  const rolls: BattleRoll[] = [];
  const base = { effectiveness: eff, crit: false, rolls };

  if (eff === 0) {
    return {
      ...base,
      outcome: "immune",
      bonusTurn: false,
      attackerRemoved: false,
      defenderRemoved: false,
      attackerMoves: false,
    };
  }

  const dodgeValue = rng.next();
  const dodged = dodgeValue < config.dodgeChance;
  rolls.push({ kind: "dodge", value: dodgeValue, hit: dodged });
  if (dodged) {
    return {
      ...base,
      outcome: "dodged",
      bonusTurn: false,
      attackerRemoved: false,
      defenderRemoved: false,
      attackerMoves: false,
    };
  }

  if (eff === 2) {
    return {
      ...base,
      outcome: "superEffective",
      bonusTurn: true,
      attackerRemoved: false,
      defenderRemoved: true,
      attackerMoves: true,
    };
  }

  if (eff === 0.5) {
    return {
      ...base,
      outcome: "resisted",
      bonusTurn: false,
      attackerRemoved: true,
      defenderRemoved: true,
      attackerMoves: false,
    };
  }

  const critValue = rng.next();
  const crit = critValue < config.critChance;
  rolls.push({ kind: "crit", value: critValue, hit: crit });
  return {
    ...base,
    crit,
    outcome: "captured",
    bonusTurn: crit,
    attackerRemoved: false,
    defenderRemoved: true,
    attackerMoves: true,
  };
}
