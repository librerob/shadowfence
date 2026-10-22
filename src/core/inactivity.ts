const idleLimit = 5 * 60_000;
const hiddenLimit = 60_000;

// Consult on resume and before activity, as background timers may be suspended.
export class Inactivity {
  private last = 0;
  private hiddenAt: number | null = null;

  reset(now: number, hidden: boolean) {
    this.last = now;
    this.hiddenAt = hidden ? now : null;
  }

  expired(now: number) {
    return (
      now < this.last ||
      now - this.last >= idleLimit ||
      (this.hiddenAt !== null && now - this.hiddenAt >= hiddenLimit)
    );
  }

  activity(now: number) {
    this.last = now;
  }

  visibility(now: number, hidden: boolean) {
    this.hiddenAt = hidden ? (this.hiddenAt ?? now) : null;
  }
}
