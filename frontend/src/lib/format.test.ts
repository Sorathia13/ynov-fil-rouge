import { describe, expect, it } from 'vitest';
import { formatDuration, formatPrice, minutesToHHMM, weekdayLabel } from './format';

describe('format helpers', () => {
  it('formats a price in euros', () => {
    // Non-breaking spaces vary by platform; assert the meaningful parts.
    const out = formatPrice(2500);
    expect(out).toContain('25');
    expect(out).toContain('€');
  });

  it('formats durations', () => {
    expect(formatDuration(30)).toBe('30 min');
    expect(formatDuration(90)).toBe('1 h 30');
    expect(formatDuration(120)).toBe('2 h');
  });

  it('converts minutes to HH:MM', () => {
    expect(minutesToHHMM(540)).toBe('09:00');
    expect(minutesToHHMM(810)).toBe('13:30');
  });

  it('returns French weekday labels', () => {
    expect(weekdayLabel(1)).toBe('Lundi');
    expect(weekdayLabel(0)).toBe('Dimanche');
  });
});
