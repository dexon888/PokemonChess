import { describe, expect, it } from "vitest";
import {
  applyAction,
  createRandomStartingPosition,
  createScriptedRng,
  createSeededRng,
  createStartingPosition,
  IllegalActionError,
  legalMoves,
  newGame,
  type Action,
  type GameState,
  type Position,
  type Role,
  type RosterEntry,
} from "../src/index.js";
import { position, sq } from "./helpers.js";

const HIT = 0.05; // dodge or crit succeeds
const MISS = 0.5; // dodge or crit fails
const none = { kingSide: false, queenSide: false };
const both = { kingSide: true, queenSide: true };

const game = (pieces: Record<string, string>, opts: Partial<Position> = {}): GameState =>
  newGame(position(pieces, opts));
const mv = (from: string, to: string, promotion?: Role) =>
  ({ type: "move", from: sq(from), to: sq(to), ...(promotion ? { promotion } : {}) }) as Action;
const play = (g: GameState, a: Action, rolls: number[] = []) =>
  applyAction(g, a, createScriptedRng(rolls));
const at = (g: GameState, s: string) => g.board[sq(s)];

// A spare white and black pawn keep positions from ending in stalemate during tests.
const spare = { a2: "wP", h7: "bP" };

describe("basic flow", () => {
  it("a quiet move passes the turn and never touches the RNG", () => {
    const g = game({ e1: "wK", e8: "bK", ...spare, d1: "wQ" });
    const { state, events } = play(g, mv("d1", "d4"));
    expect(at(state, "d4")?.role).toBe("queen");
    expect(state.turn).toBe("black");
    expect(state.ply).toBe(1);
    expect(events[0]).toMatchObject({ type: "move" });
    expect(g.board[sq("d1")]?.role).toBe("queen"); // input not mutated
  });

  it("rejects moving the opponent's piece, illegal moves, and actions after game over", () => {
    const g = game({ e1: "wK", e8: "bK", ...spare });
    expect(() => play(g, mv("e8", "e7"))).toThrow(IllegalActionError);
    expect(() => play(g, mv("e1", "e3"))).toThrow(IllegalActionError);
    const over = play(g, { type: "resign", color: "white" }).state;
    expect(() => play(over, mv("e1", "e2"))).toThrow(IllegalActionError);
  });
});

describe("battles on the board", () => {
  const base = { e1: "wK", e8: "bK", ...spare };

  it("2× captures, attacker advances, and grants a bonus turn", () => {
    const g = game({ ...base, d4: "wQ:Fighting", g4: "bR:Rock" });
    const { state, events } = play(g, mv("d4", "g4"), [MISS]);
    expect(at(state, "g4")?.type).toBe("Fighting");
    expect(at(state, "d4")).toBeNull();
    expect(state.turn).toBe("white");
    expect(state.bonusTurn).toBe(true);
    expect(events.map((e) => e.type)).toEqual(["battle", "bonusTurn"]);
  });

  it("bonus turns chain across several captures", () => {
    let g = game({ ...base, d4: "wQ:Fighting", g4: "bR:Rock", g7: "bB:Steel" });
    g = play(g, mv("d4", "g4"), [MISS]).state;
    g = play(g, mv("g4", "g7"), [MISS]).state;
    expect(g.turn).toBe("white");
    expect(at(g, "g7")?.type).toBe("Fighting");
  });

  it("1× captures pass the turn unless a crit lands", () => {
    const g = game({ ...base, d4: "wQ:Fighting", d7: "bQ:Dragon" });
    expect(play(g, mv("d4", "d7"), [MISS, MISS]).state.turn).toBe("black");
    const crit = play(g, mv("d4", "d7"), [MISS, HIT]).state;
    expect(crit.turn).toBe("white");
    expect(crit.bonusTurn).toBe(true);
  });

  it("½× removes both pieces", () => {
    const g = game({ ...base, d4: "wQ:Fighting", e5: "bP:Flying" });
    const { state } = play(g, mv("d4", "e5"), [MISS]);
    expect(at(state, "d4")).toBeNull();
    expect(at(state, "e5")).toBeNull();
    expect(state.turn).toBe("black");
  });

  it("0× and dodges leave the board unchanged and end the turn", () => {
    const g = game({ ...base, d4: "wQ:Fighting", b6: "bB:Ghost", d7: "bQ:Dragon" });
    const immune = play(g, mv("d4", "b6")).state;
    expect(at(immune, "d4")?.role).toBe("queen");
    expect(at(immune, "b6")?.role).toBe("bishop");
    expect(immune.turn).toBe("black");
    const dodged = play(g, mv("d4", "d7"), [HIT]).state;
    expect(at(dodged, "d7")?.role).toBe("queen");
    expect(at(dodged, "d4")?.role).toBe("queen");
  });
});

describe("kings (R1, R2)", () => {
  it("capturing the king wins, even on a super-effective bonus capture", () => {
    const g = game({ e1: "wK", e8: "bK:Rock", e4: "wR:Fighting", ...spare });
    const { state, events } = play(g, mv("e4", "e8"), [MISS]);
    expect(state.status).toEqual({ state: "won", winner: "white", reason: "kingCaptured" });
    expect(state.bonusTurn).toBe(false);
    expect(events.at(-1)?.type).toBe("gameOver");
  });

  it("a king can dodge or be immune and survive", () => {
    const g = game({ e1: "wK", e8: "bK:Ghost", e4: "wR:Normal", ...spare });
    expect(play(g, mv("e4", "e8")).state.status.state).toBe("active");
    const g2 = game({ e1: "wK", e8: "bK", e4: "wR", ...spare });
    expect(play(g2, mv("e4", "e8"), [HIT]).state.status.state).toBe("active");
  });

  it("a non-king ½× attack on a king: the attacker's side wins (R2)", () => {
    const g = game({ e1: "wK", e8: "bK:Steel", e4: "wR:Grass", ...spare });
    expect(play(g, mv("e4", "e8"), [MISS]).state.status).toMatchObject({
      state: "won",
      winner: "white",
    });
  });

  it("a king attacking at ½× and fainting loses", () => {
    const g = game({ e1: "wK:Grass", e8: "bK", e2: "bP:Fire", ...spare });
    expect(play(g, mv("e1", "e2"), [MISS]).state.status).toMatchObject({
      state: "won",
      winner: "black",
    });
  });

  it("king ½× king is a draw by double knockout (R1)", () => {
    const g = game({ e4: "wK:Grass", e5: "bK:Fire", ...spare });
    expect(play(g, mv("e4", "e5"), [MISS]).state.status).toEqual({
      state: "draw",
      reason: "doubleKnockout",
    });
  });
});

describe("special moves", () => {
  it("castling moves both pieces and removes rights", () => {
    const g = game(
      { e1: "wK", h1: "wR", a1: "wR", e8: "bK", ...spare },
      { castling: { white: both, black: none } },
    );
    const { state } = play(g, mv("e1", "g1"));
    expect(at(state, "g1")?.role).toBe("king");
    expect(at(state, "f1")?.role).toBe("rook");
    expect(at(state, "h1")).toBeNull();
    expect(state.castling.white).toEqual(none);
  });

  it("moving or losing a rook clears only that side's right (R10)", () => {
    const rights = { castling: { white: both, black: none } };
    const g = game({ e1: "wK", h1: "wR", a1: "wR", e8: "bK", ...spare }, rights);
    expect(play(g, mv("h1", "h4")).state.castling.white).toEqual({
      kingSide: false,
      queenSide: true,
    });
    const traded = game(
      { e1: "wK", a1: "wR:Fire", a8: "bR:Water", e8: "bK", h2: "wP", h7: "bP" },
      { turn: "black", castling: { white: both, black: none } },
    );
    // Black's Water rook hits the Fire rook for 2×: the white rook is gone.
    expect(play(traded, mv("a8", "a1"), [MISS]).state.castling.white.queenSide).toBe(false);
  });

  it("double push opens en passant for the opponent's next action only (R6)", () => {
    const g = game({ e1: "wK", e8: "bK", e2: "wP", d4: "bP", h7: "bP", a2: "wP" });
    const pushed = play(g, mv("e2", "e4")).state;
    expect(pushed.enPassant).toMatchObject({ target: sq("e3"), victim: sq("e4") });
    const ep = play(pushed, mv("d4", "e3"), [MISS, MISS]).state;
    expect(at(ep, "e3")?.color).toBe("black");
    expect(at(ep, "e4")).toBeNull();

    const waited = play(pushed, mv("h7", "h6")).state;
    expect(waited.enPassant).toBeNull();
  });

  it("en passant can fail: dodge keeps both pawns, ½× removes both", () => {
    const g = game({ e1: "wK", e8: "bK", e2: "wP:Fire", d4: "bP:Grass", h7: "bP", a2: "wP" });
    const pushed = play(g, mv("e2", "e4")).state;
    const dodged = play(pushed, mv("d4", "e3"), [HIT]).state;
    expect(at(dodged, "d4")?.role).toBe("pawn");
    expect(at(dodged, "e4")?.role).toBe("pawn");
    expect(dodged.enPassant).toBeNull();
    const resisted = play(pushed, mv("d4", "e3"), [MISS]).state;
    expect(at(resisted, "d4")).toBeNull();
    expect(at(resisted, "e4")).toBeNull();
    expect(at(resisted, "e3")).toBeNull();
  });

  it("promotion requires a role and keeps species and type", () => {
    const g = game({ e1: "wK", e8: "bK", a7: "wP:Water", h7: "bP" });
    expect(() => play(g, mv("a7", "a8"))).toThrow(IllegalActionError);
    const { state, events } = play(g, mv("a7", "a8", "knight"));
    expect(at(state, "a8")).toMatchObject({ role: "knight", type: "Water", species: "Test" });
    expect(events.map((e) => e.type)).toContain("promotion");
  });

  it("no promotion when the capture onto the last rank fails (R7)", () => {
    const g = game({ e1: "wK", e8: "bK", a7: "wP:Normal", b8: "bN:Ghost", h7: "bP" });
    const { state } = play(g, mv("a7", "b8", "queen"));
    expect(at(state, "a7")?.role).toBe("pawn");
    expect(at(state, "b8")?.role).toBe("knight");
  });
});

describe("draws and endings", () => {
  it("stalemate when the next side has no legal action", () => {
    const g = game({ a2: "wP", a4: "bP" });
    const after = play(g, mv("a2", "a3")).state;
    expect(after.status).toEqual({ state: "draw", reason: "stalemate" });
  });

  it("100 half-moves without pawn moves or completed captures is a draw; failed captures don't reset", () => {
    let g = game({ a1: "wK", e1: "wR:Normal", e8: "bK:Ghost", h8: "bR" });
    g = { ...g, halfMoveClock: 98 };
    g = play(g, mv("e1", "e8")).state; // 0×: counts as a half-move
    expect(g.halfMoveClock).toBe(99);
    const { state } = play(g, mv("h8", "h7"));
    expect(state.status).toEqual({ state: "draw", reason: "halfMoveLimit" });
  });

  it("completed captures and pawn moves reset the clock", () => {
    let g = { ...game({ e1: "wK", e8: "bK", d4: "wQ:Fighting", e5: "bP:Flying", ...spare }) };
    g = { ...g, halfMoveClock: 50 };
    expect(play(g, mv("d4", "e5"), [MISS]).state.halfMoveClock).toBe(0);
    expect(play(g, mv("a2", "a3")).state.halfMoveClock).toBe(0);
  });

  it("resignation, timeout and agreement end the game", () => {
    const g = game({ e1: "wK", e8: "bK", ...spare });
    expect(play(g, { type: "resign", color: "black" }).state.status).toMatchObject({
      winner: "white",
      reason: "resignation",
    });
    expect(play(g, { type: "timeout", color: "white" }).state.status).toMatchObject({
      winner: "black",
      reason: "timeout",
    });
    expect(play(g, { type: "agreeDraw" }).state.status).toEqual({
      state: "draw",
      reason: "agreement",
    });
  });
});

describe("assignment and perft", () => {
  const roster: RosterEntry[] = [
    { id: "a", name: "Alpha", types: ["Fire"] },
    { id: "b", name: "Beta", types: ["Water", "Flying"] },
  ];

  it("assigns every piece a Pokémon and one of its types, reproducibly", () => {
    const a = createRandomStartingPosition(roster, createSeededRng(7));
    const b = createRandomStartingPosition(roster, createSeededRng(7));
    expect(a).toEqual(b);
    const pieces = a.board.filter((p) => p !== null);
    expect(pieces).toHaveLength(32);
    for (const p of pieces) {
      const mon = roster.find((r) => r.name === p.species);
      expect(mon?.types).toContain(p.type);
    }
  });

  it("perft from the start matches standard chess to depth 3 (20, 400, 8902)", () => {
    // All Normal, no dodge/crit: every capture succeeds at 1× with no bonus turn.
    const start = newGame(createStartingPosition(() => ({ species: "T", type: "Normal" })));
    const rng = createSeededRng(1);
    const cfg = { dodgeChance: 0, critChance: 0 };
    const perft = (g: GameState, depth: number): number => {
      if (depth === 0) return 1;
      let n = 0;
      for (const m of legalMoves(g)) {
        const action: Action = {
          type: "move",
          from: m.from,
          to: m.to,
          ...(m.promotes ? { promotion: "queen" as const } : {}),
        };
        n += perft(applyAction(g, action, rng, cfg).state, depth - 1);
      }
      return n;
    };
    expect([1, 2, 3].map((d) => perft(start, d))).toEqual([20, 400, 8902]);
  });
});
