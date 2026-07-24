import { describe, expect, it } from 'vitest';
import {
  contains,
  durationMinutes,
  durationMs,
  interval,
  mergeIntervals,
  overlaps,
  subtractIntervals,
} from './interval';

const H = 3_600_000; // one hour in ms

describe('interval()', () => {
  it('builds a valid interval', () => {
    const i = interval(0, H);
    expect(i).toEqual({ start: 0, end: H });
  });

  it('rejects end <= start', () => {
    expect(() => interval(H, H)).toThrow(RangeError);
    expect(() => interval(2 * H, H)).toThrow(RangeError);
  });

  it('rejects non-finite bounds', () => {
    expect(() => interval(Number.NaN, H)).toThrow(RangeError);
    expect(() => interval(0, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('durations', () => {
  it('computes ms and minutes', () => {
    const i = interval(0, 90 * 60_000);
    expect(durationMs(i)).toBe(90 * 60_000);
    expect(durationMinutes(i)).toBe(90);
  });
});

describe('overlaps()', () => {
  it('detects overlap', () => {
    expect(overlaps(interval(0, 2 * H), interval(H, 3 * H))).toBe(true);
  });

  it('treats adjacency as non-overlapping (back-to-back allowed)', () => {
    expect(overlaps(interval(0, H), interval(H, 2 * H))).toBe(false);
  });

  it('is symmetric', () => {
    const a = interval(0, 2 * H);
    const b = interval(H, 3 * H);
    expect(overlaps(a, b)).toBe(overlaps(b, a));
  });

  it('detects containment as overlap', () => {
    expect(overlaps(interval(0, 4 * H), interval(H, 2 * H))).toBe(true);
  });
});

describe('contains()', () => {
  it('true when outer wraps inner (inclusive bounds)', () => {
    expect(contains(interval(0, 4 * H), interval(H, 2 * H))).toBe(true);
    expect(contains(interval(0, 2 * H), interval(0, 2 * H))).toBe(true);
  });
  it('false when inner exceeds outer', () => {
    expect(contains(interval(0, 2 * H), interval(H, 3 * H))).toBe(false);
  });
});

describe('mergeIntervals()', () => {
  it('returns [] for empty input', () => {
    expect(mergeIntervals([])).toEqual([]);
  });

  it('coalesces overlapping and touching intervals, sorted', () => {
    const merged = mergeIntervals([
      interval(2 * H, 3 * H),
      interval(0, H),
      interval(H, 2 * H), // touches the first
      interval(5 * H, 6 * H),
    ]);
    expect(merged).toEqual([interval(0, 3 * H), interval(5 * H, 6 * H)]);
  });

  it('does not mutate the input', () => {
    const input = [interval(0, H)];
    mergeIntervals(input);
    expect(input).toEqual([interval(0, H)]);
  });
});

describe('subtractIntervals()', () => {
  it('returns the whole base when nothing is busy', () => {
    expect(subtractIntervals(interval(0, 8 * H), [])).toEqual([interval(0, 8 * H)]);
  });

  it('carves out a busy period in the middle', () => {
    const free = subtractIntervals(interval(0, 8 * H), [interval(3 * H, 4 * H)]);
    expect(free).toEqual([interval(0, 3 * H), interval(4 * H, 8 * H)]);
  });

  it('handles busy periods overflowing the base bounds', () => {
    const free = subtractIntervals(interval(2 * H, 6 * H), [
      interval(0, 3 * H),
      interval(5 * H, 10 * H),
    ]);
    expect(free).toEqual([interval(3 * H, 5 * H)]);
  });

  it('returns [] when fully covered', () => {
    expect(subtractIntervals(interval(0, 4 * H), [interval(0, 4 * H)])).toEqual([]);
  });

  it('ignores busy periods that do not intersect the base', () => {
    const free = subtractIntervals(interval(0, 2 * H), [interval(5 * H, 6 * H)]);
    expect(free).toEqual([interval(0, 2 * H)]);
  });
});
