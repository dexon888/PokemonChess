import type { Role } from "@pokemon-chess/engine";
import { z } from "zod";
import { TIME_CONTROL_IDS, type TimeControlId } from "./timeControls.js";

/**
 * Everything a client may send. The server validates each payload with these schemas before the
 * engine sees it; anything that fails is rejected without touching the match.
 */

const square = z.number().int().min(0).max(63);

const PROMOTIONS = ["queen", "rook", "bishop", "knight"] as const satisfies readonly Role[];

const empty = z.strictObject({});

/** Payload schema per Colyseus message type. */
export const CLIENT_MESSAGES = {
  /** A move or capture. `promotion` is sent with the move (R8) and ignored unless it promotes. */
  move: z.strictObject({
    from: square,
    to: square,
    promotion: z.enum(PROMOTIONS).optional(),
  }),
  resign: empty,
  /** Offer a draw, allowed during bonus turns (GAME_RULES §4). */
  offerDraw: empty,
  /** Answer the opponent's pending draw offer. */
  answerDraw: z.strictObject({ accept: z.boolean() }),
  /** After the opponent's reconnect grace runs out (R12), end the match as a win. */
  claimVictory: empty,
  /** Ask for (or agree to) a rematch once the match is over (PRD 5.5). */
  rematch: empty,
} as const;

export type ClientMessageType = keyof typeof CLIENT_MESSAGES;
export type ClientMessage = {
  [K in ClientMessageType]: { type: K; payload: z.infer<(typeof CLIENT_MESSAGES)[K]> };
}[ClientMessageType];

export const CLIENT_MESSAGE_TYPES = Object.keys(CLIENT_MESSAGES) as ClientMessageType[];

export type ParseResult = { ok: true; message: ClientMessage } | { ok: false; error: string };

/** Validates one incoming message. Unknown types and malformed payloads are errors. */
export function parseClientMessage(type: unknown, payload: unknown): ParseResult {
  if (typeof type !== "string" || !Object.hasOwn(CLIENT_MESSAGES, type)) {
    return { ok: false, error: `Unknown message type: ${String(type)}` };
  }
  const t = type as ClientMessageType;
  // Colyseus delivers `undefined` for messages sent without a payload.
  const result = CLIENT_MESSAGES[t].safeParse(payload ?? {});
  if (!result.success) {
    return { ok: false, error: z.prettifyError(result.error) };
  }
  return { ok: true, message: { type: t, payload: result.data } as ClientMessage };
}

/** Guest nickname (R13): trimmed, 1–20 characters, no control or invisible characters. */
export const nicknameSchema = z
  .string()
  .trim()
  .min(1, "Nickname is required")
  .max(20, "Nickname is at most 20 characters")
  .regex(/^[^\p{C}]+$/u, "Nickname contains invalid characters");

/** Options sent when joining any room. */
export const joinOptionsSchema = z.strictObject({ nickname: nicknameSchema });
export type JoinOptions = z.infer<typeof joinOptionsSchema>;

/** Options sent when creating a private room. */
export const createPrivateOptionsSchema = joinOptionsSchema.extend({
  timeControl: z.enum(TIME_CONTROL_IDS as [TimeControlId, ...TimeControlId[]]),
});
export type CreatePrivateOptions = z.infer<typeof createPrivateOptionsSchema>;
