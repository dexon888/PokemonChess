import {
  opponent,
  squareName,
  type BattleOutcome,
  type Color,
  type GameEvent,
  type GameState,
  type Piece,
  type Square,
} from "@pokemon-chess/engine";
import { ROLE_NAME } from "./theme";

export type LogTag =
  "MOVE" | "2×" | "CRIT" | "KO" | "½×" | "0×" | "DODGE" | "PROMO" | "BONUS" | "END";

export interface LogEntry {
  id: number;
  tag: LogTag;
  text: string;
  color: Color | null;
}

export interface Banner {
  id: number;
  outcome: BattleOutcome | "crit";
  title: string;
  line: string;
}

export interface Stats {
  captures: number;
  superEffective: number;
  crits: number;
  dodges: number;
}

export const emptyStats = (): Stats => ({ captures: 0, superEffective: 0, crits: 0, dodges: 0 });
export const emptyBothStats = (): Record<Color, Stats> => ({
  white: emptyStats(),
  black: emptyStats(),
});

export interface HitSquare {
  sq: Square;
  kind: BattleOutcome;
  id: number;
}

export interface Narration {
  /** New log entries, newest first. */
  entries: LogEntry[];
  /** The banner for the last battle in these events, if any. */
  banner: Banner | null;
  hit: HitSquare | null;
  stats: Record<Color, Stats>;
  /** The squares to highlight as the last move, if these events moved a piece. */
  lastMove: { from: Square; to: Square } | null;
}

const colorName = (c: Color) => (c === "white" ? "White" : "Black");

/**
 * Turns one action's events into what the player reads: log lines, a battle banner, the square
 * to shake, updated stats and the last-move highlight. Pure, and the same for local and online
 * play: online, the events come from the server and the client only describes them.
 *
 * `before` is the state the events were applied to (for species names); `nextId` hands out ids.
 */
export function narrate(
  before: GameState,
  events: GameEvent[],
  stats: Record<Color, Stats>,
  nextId: () => number,
): Narration {
  const byId = new Map<string, Piece>();
  before.board.forEach((p) => p && byId.set(p.id, p));
  const name = (id: string) => byId.get(id)?.species ?? "?";

  const entries: LogEntry[] = [];
  const push = (tag: LogTag, text: string, color: Color | null) =>
    entries.push({ id: nextId(), tag, text, color });
  const next = { white: { ...stats.white }, black: { ...stats.black } };
  let banner: Banner | null = null;
  let hit: HitSquare | null = null;
  let lastMove: Narration["lastMove"] = null;

  for (const e of events) {
    switch (e.type) {
      case "move":
        lastMove = { from: e.from, to: e.to };
        push(
          "MOVE",
          `${name(e.pieceId)} moved ${squareName(e.from)} → ${squareName(e.to)}.`,
          e.color,
        );
        break;
      case "castle":
        lastMove = { from: e.kingFrom, to: e.kingTo };
        push("MOVE", `${colorName(e.color)} castled.`, e.color);
        break;
      case "promotion":
        push("PROMO", `${name(e.pieceId)} was promoted to ${ROLE_NAME[e.role]}.`, e.color);
        break;
      case "bonusTurn":
        push("BONUS", `${colorName(e.color)} moves again!`, e.color);
        break;
      case "gameOver": {
        const s = e.status;
        const text =
          s.state === "won"
            ? `${colorName(s.winner)} wins by ${winText(s.reason)}.`
            : `Draw by ${drawText(s.reason)}.`;
        push("END", text, null);
        break;
      }
      case "battle": {
        lastMove = { from: e.from, to: e.to };
        const a = name(e.attackerId);
        const d = name(e.defenderId);
        const attacker = byId.get(e.attackerId);
        const r = e.result;
        const st = next[e.color];
        const def = next[opponent(e.color)];
        let b: Omit<Banner, "id">;
        if (r.outcome === "immune") {
          push(
            "0×",
            `No effect! ${d} is immune to ${a}'s ${attacker?.type ?? ""} attack.`,
            e.color,
          );
          b = { outcome: "immune", title: "No effect!", line: `${d} is immune.` };
        } else if (r.outcome === "dodged") {
          def.dodges++;
          push("DODGE", `${d} dodged ${a}'s attack!`, e.color);
          b = { outcome: "dodged", title: "Dodged!", line: `${d} avoided the attack.` };
        } else if (r.outcome === "superEffective") {
          st.captures++;
          st.superEffective++;
          push("2×", `Super effective! ${a} knocked out ${d}.`, e.color);
          b = {
            outcome: "superEffective",
            title: "Super effective!",
            line: `${a} knocked out ${d}.`,
          };
        } else if (r.outcome === "resisted") {
          st.captures++;
          push("½×", `Not very effective… ${a} and ${d} both fainted.`, e.color);
          b = {
            outcome: "resisted",
            title: "Not very effective…",
            line: `${a} and ${d} both fainted.`,
          };
        } else if (r.crit) {
          st.captures++;
          st.crits++;
          push("CRIT", `Critical hit! ${a} knocked out ${d}.`, e.color);
          b = { outcome: "crit", title: "Critical hit!", line: `${a} knocked out ${d}.` };
        } else {
          st.captures++;
          push("KO", `${a} knocked out ${d}.`, e.color);
          b = { outcome: "captured", title: "Knocked out", line: `${a} knocked out ${d}.` };
        }
        banner = { ...b, id: nextId() };
        hit = { sq: e.defenderSquare, kind: r.outcome, id: banner.id };
        break;
      }
    }
  }
  return { entries: entries.reverse(), banner, hit, stats: next, lastMove };
}

function winText(r: string) {
  return (
    {
      kingCaptured: "capturing the king",
      resignation: "resignation",
      timeout: "timeout",
      abandonment: "abandonment",
    }[r] ?? r
  );
}

function drawText(r: string) {
  return (
    {
      stalemate: "stalemate",
      agreement: "agreement",
      halfMoveLimit: "the 100 half-move rule",
      doubleKnockout: "double knockout",
    }[r] ?? r
  );
}
