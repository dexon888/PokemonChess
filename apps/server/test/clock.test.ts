import { describe, expect, it } from "vitest";
import { ChessClock } from "../src/clock.js";

const S = 1000;

describe("ChessClock", () => {
  it("only the running side loses time", () => {
    const c = new ChessClock(60 * S, 0);
    c.start("white", 0);
    expect(c.state(10 * S)).toEqual({ white: 50 * S, black: 60 * S, running: "white", at: 10 * S });
  });

  it("pressing charges the mover, adds the increment and starts the next side", () => {
    const c = new ChessClock(60 * S, 5 * S);
    c.start("white", 0);
    c.press("white", "black", 10 * S);
    expect(c.remainingAt("white", 10 * S)).toBe(55 * S); // 60 - 10 + 5
    expect(c.remainingAt("black", 13 * S)).toBe(57 * S);
    expect(c.state(13 * S).running).toBe("black");
  });

  it("a bonus action keeps the same clock running and still earns the increment (R11)", () => {
    const c = new ChessClock(60 * S, 5 * S);
    c.start("white", 0);
    c.press("white", "white", 4 * S); // capture with a bonus turn
    expect(c.state(4 * S)).toMatchObject({ white: 61 * S, running: "white" });
    c.press("white", "black", 6 * S);
    expect(c.remainingAt("white", 6 * S)).toBe(64 * S); // 61 - 2 + 5
  });

  it("flags the running side at exactly zero and never shows negative time", () => {
    const c = new ChessClock(10 * S, 0);
    c.start("white", 0);
    expect(c.flagged(10 * S - 1)).toBeNull();
    expect(c.msUntilFlag(4 * S)).toBe(6 * S);
    expect(c.flagged(10 * S)).toBe("white");
    expect(c.remainingAt("white", 99 * S)).toBe(0);
  });

  it("stopping freezes both clocks", () => {
    const c = new ChessClock(60 * S, 5 * S);
    c.start("white", 0);
    c.stop(7 * S);
    expect(c.state(100 * S)).toEqual({ white: 53 * S, black: 60 * S, running: null, at: 100 * S });
    expect(c.msUntilFlag(100 * S)).toBeNull();
    expect(c.flagged(1000 * S)).toBeNull();
  });
});
