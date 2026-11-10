import { describe, expect, it } from "vitest";
import {
  CLIENT_MESSAGE_TYPES,
  createPrivateOptionsSchema,
  joinOptionsSchema,
  parseClientMessage,
  TIME_CONTROLS,
} from "../src/index.js";

const ok = (type: unknown, payload?: unknown) => parseClientMessage(type, payload).ok;

describe("parseClientMessage", () => {
  it("accepts a plain move and a move with a promotion choice", () => {
    expect(parseClientMessage("move", { from: 12, to: 28 })).toEqual({
      ok: true,
      message: { type: "move", payload: { from: 12, to: 28 } },
    });
    expect(ok("move", { from: 52, to: 60, promotion: "knight" })).toBe(true);
  });

  it("rejects off-board, fractional and missing squares", () => {
    expect(ok("move", { from: -1, to: 4 })).toBe(false);
    expect(ok("move", { from: 0, to: 64 })).toBe(false);
    expect(ok("move", { from: 1.5, to: 4 })).toBe(false);
    expect(ok("move", { from: "e2", to: "e4" })).toBe(false);
    expect(ok("move", { from: 12 })).toBe(false);
  });

  it("only allows the four promotion pieces", () => {
    expect(ok("move", { from: 52, to: 60, promotion: "king" })).toBe(false);
    expect(ok("move", { from: 52, to: 60, promotion: "pawn" })).toBe(false);
  });

  it("rejects unknown fields so clients cannot smuggle extra data", () => {
    expect(ok("move", { from: 12, to: 28, crit: true })).toBe(false);
    expect(ok("resign", { color: "black" })).toBe(false);
  });

  it("treats a missing payload as empty for payload-less messages", () => {
    for (const t of ["resign", "offerDraw", "claimVictory", "rematch"]) {
      expect(ok(t)).toBe(true);
    }
    expect(ok("answerDraw")).toBe(false);
    expect(ok("answerDraw", { accept: true })).toBe(true);
  });

  it("rejects unknown and non-string message types, including prototype keys", () => {
    expect(ok("teleport", {})).toBe(false);
    expect(ok(7, {})).toBe(false);
    expect(ok("toString", {})).toBe(false);
    expect(ok("__proto__", {})).toBe(false);
  });

  it("reports a readable error", () => {
    const r = parseClientMessage("move", { from: 99, to: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/from/);
  });

  it("lists every message type", () => {
    expect(CLIENT_MESSAGE_TYPES.sort()).toEqual(
      ["answerDraw", "claimVictory", "move", "offerDraw", "rematch", "resign"].sort(),
    );
  });
});

describe("join options", () => {
  it("trims nicknames and enforces 1–20 visible characters", () => {
    expect(joinOptionsSchema.parse({ nickname: "  Ash  " })).toEqual({ nickname: "Ash" });
    expect(joinOptionsSchema.safeParse({ nickname: "   " }).success).toBe(false);
    expect(joinOptionsSchema.safeParse({ nickname: "x".repeat(21) }).success).toBe(false);
    expect(joinOptionsSchema.safeParse({ nickname: "Misty 🌊" }).success).toBe(true);
    expect(joinOptionsSchema.safeParse({ nickname: "bad\u0000name" }).success).toBe(false);
    expect(
      joinOptionsSchema.safeParse({ nickname: "zero" + String.fromCharCode(0x200b) + "width" })
        .success,
    ).toBe(false);
  });

  it("private rooms need one of the R11 time controls", () => {
    expect(
      createPrivateOptionsSchema.safeParse({ nickname: "Ash", timeControl: "5+3" }).success,
    ).toBe(true);
    expect(
      createPrivateOptionsSchema.safeParse({ nickname: "Ash", timeControl: "untimed" }).success,
    ).toBe(true);
    expect(
      createPrivateOptionsSchema.safeParse({ nickname: "Ash", timeControl: "1+0" }).success,
    ).toBe(false);
    expect(createPrivateOptionsSchema.safeParse({ nickname: "Ash" }).success).toBe(false);
  });
});

describe("time controls (R11)", () => {
  it("match the decision log", () => {
    expect(TIME_CONTROLS["10+5"]).toEqual({ initialMs: 600_000, incrementMs: 5_000 });
    expect(TIME_CONTROLS["5+3"]).toEqual({ initialMs: 300_000, incrementMs: 3_000 });
    expect(TIME_CONTROLS["30+0"]).toEqual({ initialMs: 1_800_000, incrementMs: 0 });
    expect(TIME_CONTROLS.untimed).toBeNull();
  });
});
