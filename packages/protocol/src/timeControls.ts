/** Time controls from R11. Matchmaking always uses 10+5; private rooms pick one. */
export const TIME_CONTROLS = {
  "5+3": { initialMs: 5 * 60_000, incrementMs: 3_000 },
  "10+5": { initialMs: 10 * 60_000, incrementMs: 5_000 },
  "30+0": { initialMs: 30 * 60_000, incrementMs: 0 },
  untimed: null,
} as const;

export type TimeControlId = keyof typeof TIME_CONTROLS;
export const TIME_CONTROL_IDS = Object.keys(TIME_CONTROLS) as TimeControlId[];

export const MATCHMAKING_TIME_CONTROL: TimeControlId = "10+5";

/** R12: a disconnected player has 60 seconds to return; their clock keeps running. */
export const RECONNECT_GRACE_MS = 60_000;
