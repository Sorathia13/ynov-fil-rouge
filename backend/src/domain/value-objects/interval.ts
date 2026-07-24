/**
 * Interval — a half-open time interval [start, end) expressed in epoch milliseconds.
 *
 * This value object is the atomic unit of the scheduling domain. Keeping the
 * representation numeric (epoch ms) makes all interval algebra pure, allocation-free
 * and trivially unit-testable, independently of any timezone concern (which is
 * resolved upstream in {@link ../services/availability.service}).
 */
export interface Interval {
  /** Inclusive start, epoch milliseconds. */
  readonly start: number;
  /** Exclusive end, epoch milliseconds. */
  readonly end: number;
}

/** Build an interval, guarding the [start < end) invariant. */
export function interval(start: number, end: number): Interval {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new RangeError('Interval bounds must be finite numbers');
  }
  if (end <= start) {
    throw new RangeError(`Invalid interval: end (${end}) must be strictly greater than start (${start})`);
  }
  return { start, end };
}

/** Duration of an interval in milliseconds. */
export function durationMs(i: Interval): number {
  return i.end - i.start;
}

/** Duration of an interval in whole minutes. */
export function durationMinutes(i: Interval): number {
  return Math.round((i.end - i.start) / 60_000);
}

/**
 * True when two half-open intervals share at least one instant.
 * Adjacent intervals (a.end === b.start) do NOT overlap — this is what allows
 * back-to-back appointments.
 */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** True when `outer` fully contains `inner`. */
export function contains(outer: Interval, inner: Interval): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}

/**
 * Merge a list of intervals into the minimal set of non-overlapping, sorted
 * intervals. Touching intervals are coalesced.
 */
export function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      // overlapping or touching -> extend
      merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, current.end) };
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

/**
 * Subtract a set of `busy` intervals from a single `base` interval, returning the
 * free sub-intervals that remain (sorted, non-overlapping).
 */
export function subtractIntervals(base: Interval, busy: readonly Interval[]): Interval[] {
  const blockers = mergeIntervals(busy.filter((b) => overlaps(b, base)));
  const free: Interval[] = [];
  let cursor = base.start;
  for (const b of blockers) {
    const blockStart = Math.max(b.start, base.start);
    const blockEnd = Math.min(b.end, base.end);
    if (blockStart > cursor) {
      free.push({ start: cursor, end: blockStart });
    }
    cursor = Math.max(cursor, blockEnd);
  }
  if (cursor < base.end) {
    free.push({ start: cursor, end: base.end });
  }
  return free;
}
