import { parseSquare, squareName } from "@pokemon-chess/engine";
import { describe, expect, it } from "vitest";
import { nextFocus, screenCell, squareAt } from "../src/game/boardNav";

const go = (from: string, key: string, flipped = false, ctrl = false) => {
  const sq = nextFocus(parseSquare(from), key, flipped, ctrl);
  return sq === null ? null : squareName(sq);
};

describe("board keyboard navigation", () => {
  it("moves one square per arrow, from White's side", () => {
    expect(go("e4", "ArrowUp")).toBe("e5");
    expect(go("e4", "ArrowDown")).toBe("e3");
    expect(go("e4", "ArrowLeft")).toBe("d4");
    expect(go("e4", "ArrowRight")).toBe("f4");
  });

  it("follows the screen when the board is flipped", () => {
    expect(go("e4", "ArrowUp", true)).toBe("e3");
    expect(go("e4", "ArrowDown", true)).toBe("e5");
    expect(go("e4", "ArrowLeft", true)).toBe("f4");
    expect(go("e4", "ArrowRight", true)).toBe("d4");
  });

  it("stops at the edges instead of wrapping", () => {
    expect(go("a8", "ArrowUp")).toBe("a8");
    expect(go("a8", "ArrowLeft")).toBe("a8");
    expect(go("h1", "ArrowDown")).toBe("h1");
    expect(go("h1", "ArrowRight")).toBe("h1");
  });

  it("Home and End jump along the row; with Ctrl, to the corners", () => {
    expect(go("e4", "Home")).toBe("a4");
    expect(go("e4", "End")).toBe("h4");
    expect(go("e4", "Home", false, true)).toBe("a8");
    expect(go("e4", "End", false, true)).toBe("h1");
    expect(go("e4", "Home", true, true)).toBe("h1");
  });

  it("ignores keys the board does not handle", () => {
    expect(go("e4", "Enter")).toBeNull();
    expect(go("e4", "a")).toBeNull();
  });

  it("screenCell and squareAt are inverses in both orientations", () => {
    for (const flipped of [false, true]) {
      for (let sq = 0; sq < 64; sq++) {
        const { row, col } = screenCell(sq, flipped);
        expect(squareAt(row, col, flipped)).toBe(sq);
      }
    }
  });
});
