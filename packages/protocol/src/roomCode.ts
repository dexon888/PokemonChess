import { z } from "zod";

/**
 * Private room codes (PRD 5.2). The code is the room's ID, so `client.joinById(code)` joins it.
 * Six characters from an alphabet without look-alikes (no 0/O, 1/I/L), easy to read aloud or
 * type on a phone: 31^6 ≈ 887 million codes.
 */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

/**
 * Turns what a person typed or pasted into a canonical code: trims, uppercases, drops spaces
 * and dashes, and accepts a full invite link (anything ending in `/CODE`).
 */
export function normalizeRoomCode(input: string): string {
  const path = input.trim().split(/[?#]/)[0] ?? "";
  const last = path.split("/").filter(Boolean).at(-1) ?? "";
  return last.toUpperCase().replace(/[\s-]/g, "");
}

export const roomCodeSchema = z
  .string()
  .transform(normalizeRoomCode)
  .pipe(
    z
      .string()
      .length(ROOM_CODE_LENGTH, `A room code has ${ROOM_CODE_LENGTH} characters`)
      .regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]+$`), "That is not a valid room code"),
  );

/** Creates a random code with the given source of random integers in [0, max). */
export function makeRoomCode(randomInt: (max: number) => number): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}
