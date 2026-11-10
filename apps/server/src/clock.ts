import type { Color } from "@pokemon-chess/engine";
import type { ClockState } from "@pokemon-chess/protocol";

/**
 * A two-sided chess clock (R11). Pure: every method takes the current time, so tests can drive
 * it without timers. Only the side to move has a running clock.
 */
export class ChessClock {
  private readonly remaining: Record<Color, number>;
  private running: Color | null = null;
  private since = 0;

  constructor(
    initialMs: number,
    private readonly incrementMs: number,
  ) {
    this.remaining = { white: initialMs, black: initialMs };
  }

  /** Starts `color`'s clock. */
  start(color: Color, now: number): void {
    this.running = color;
    this.since = now;
  }

  /**
   * `mover` completed an action: charge their thinking time, add the increment (bonus actions
   * earn it too), and start the clock of whoever acts next, which may be `mover` again.
   */
  press(mover: Color, next: Color, now: number): void {
    this.charge(now);
    this.remaining[mover] += this.incrementMs;
    this.running = next;
    this.since = now;
  }

  /** The match ended: charge the running side and stop. */
  stop(now: number): void {
    this.charge(now);
    this.running = null;
  }

  /** Time `color` has left at `now`, never below zero. */
  remainingAt(color: Color, now: number): number {
    const left =
      this.remaining[color] - (this.running === color ? Math.max(0, now - this.since) : 0);
    return Math.max(0, left);
  }

  /** The side whose time has run out at `now`, if any. */
  flagged(now: number): Color | null {
    return this.running && this.remainingAt(this.running, now) <= 0 ? this.running : null;
  }

  /** Milliseconds until the running side flags, or null when no clock is running. */
  msUntilFlag(now: number): number | null {
    return this.running ? this.remainingAt(this.running, now) : null;
  }

  state(now: number): ClockState {
    return {
      white: this.remainingAt("white", now),
      black: this.remainingAt("black", now),
      running: this.running,
      at: now,
    };
  }

  private charge(now: number): void {
    if (!this.running) return;
    const left = this.remaining[this.running] - Math.max(0, now - this.since);
    this.remaining[this.running] = Math.max(0, left);
    this.since = now;
  }
}
