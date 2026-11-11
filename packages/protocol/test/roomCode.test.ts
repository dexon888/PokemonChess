import { describe, expect, it } from "vitest";
import {
  makeRoomCode,
  normalizeRoomCode,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  roomCodeSchema,
} from "../src/index.js";

describe("room codes", () => {
  it("uses six characters with no look-alikes", () => {
    expect(ROOM_CODE_LENGTH).toBe(6);
    for (const c of "0O1IL") expect(ROOM_CODE_ALPHABET).not.toContain(c);
    expect(new Set(ROOM_CODE_ALPHABET).size).toBe(ROOM_CODE_ALPHABET.length);
  });

  it("makes codes from the alphabet with the given randomness", () => {
    expect(makeRoomCode(() => 0)).toBe("AAAAAA");
    let i = 0;
    const code = makeRoomCode(() => i++);
    expect(code).toBe(ROOM_CODE_ALPHABET.slice(0, 6));
    expect(roomCodeSchema.parse(code)).toBe(code);
  });

  it("accepts what people actually type or paste", () => {
    expect(normalizeRoomCode("  abc-def ")).toBe("ABCDEF");
    expect(normalizeRoomCode("ab cd ef")).toBe("ABCDEF");
    expect(normalizeRoomCode("https://chess.example/join/K7PQ2M")).toBe("K7PQ2M");
    expect(normalizeRoomCode("https://chess.example/join/k7pq2m/?ref=x")).toBe("K7PQ2M");
    expect(roomCodeSchema.parse("k7pq-2m")).toBe("K7PQ2M");
  });

  it("rejects codes of the wrong length or with characters that never appear", () => {
    expect(roomCodeSchema.safeParse("ABCDE").success).toBe(false);
    expect(roomCodeSchema.safeParse("ABCDEFG").success).toBe(false);
    expect(roomCodeSchema.safeParse("ABCDE0").success).toBe(false);
    expect(roomCodeSchema.safeParse("ABCDEI").success).toBe(false);
    expect(roomCodeSchema.safeParse("").success).toBe(false);
  });
});
