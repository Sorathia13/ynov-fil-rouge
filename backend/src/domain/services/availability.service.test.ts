import { describe, expect, it } from 'vitest';
import {
  AppointmentEntity,
  TimeOffEntity,
  WorkingHoursEntity,
} from '../entities';
import {
  buildFreeIntervals,
  collectAppointmentBusy,
  collectTimeOff,
  expandWorkingHours,
} from './availability.service';

const utc = (y: number, mo: number, d: number, h = 0, mi = 0): Date =>
  new Date(Date.UTC(y, mo - 1, d, h, mi));

const wh = (weekday: number, startMinute: number, endMinute: number): WorkingHoursEntity => ({
  id: `wh-${weekday}-${startMinute}`,
  professionalId: 'pro-1',
  weekday,
  startMinute,
  endMinute,
});

const appt = (
  id: string,
  startAt: Date,
  endAt: Date,
  status: AppointmentEntity['status'] = 'CONFIRMED',
): AppointmentEntity => ({
  id,
  professionalId: 'pro-1',
  clientId: 'client-1',
  serviceId: 'svc-1',
  startAt,
  endAt,
  status,
  notes: null,
  createdAt: utc(2026, 1, 1),
  updatedAt: utc(2026, 1, 1),
});

describe('expandWorkingHours()', () => {
  it('expands a single weekday in UTC', () => {
    const day = utc(2026, 6, 2, 12);
    const weekday = day.getUTCDay();
    const intervals = expandWorkingHours(
      [wh(weekday, 9 * 60, 17 * 60)],
      'UTC',
      utc(2026, 6, 2),
      utc(2026, 6, 2, 23, 59),
    );
    expect(intervals).toHaveLength(1);
    expect(intervals[0]).toEqual({
      start: utc(2026, 6, 2, 9).getTime(),
      end: utc(2026, 6, 2, 17).getTime(),
    });
  });

  it('converts local wall-clock to UTC for Europe/Paris (summer = UTC+2)', () => {
    const weekday = utc(2026, 7, 1, 12).getUTCDay();
    const intervals = expandWorkingHours(
      [wh(weekday, 9 * 60, 17 * 60)],
      'Europe/Paris',
      utc(2026, 7, 1),
      utc(2026, 7, 1, 23, 59),
    );
    expect(intervals[0]).toEqual({
      start: utc(2026, 7, 1, 7).getTime(), // 09:00 Paris = 07:00 UTC
      end: utc(2026, 7, 1, 15).getTime(), // 17:00 Paris = 15:00 UTC
    });
  });

  it('supports split shifts (morning + afternoon) on the same day', () => {
    const weekday = utc(2026, 6, 2, 12).getUTCDay();
    const intervals = expandWorkingHours(
      [wh(weekday, 9 * 60, 12 * 60), wh(weekday, 13 * 60 + 30, 18 * 60)],
      'UTC',
      utc(2026, 6, 2),
      utc(2026, 6, 2, 23, 59),
    );
    expect(intervals).toHaveLength(2);
  });

  it('spans multiple days, only emitting configured weekdays', () => {
    const weekday = utc(2026, 6, 2, 12).getUTCDay(); // e.g. Tuesday
    const intervals = expandWorkingHours(
      [wh(weekday, 9 * 60, 17 * 60)],
      'UTC',
      utc(2026, 6, 1),
      utc(2026, 6, 10, 23, 59),
    );
    // Within a 10-day span there are exactly two occurrences of a given weekday.
    expect(intervals).toHaveLength(2);
  });

  it('returns [] when no working hours are configured', () => {
    expect(expandWorkingHours([], 'UTC', utc(2026, 6, 1), utc(2026, 6, 30))).toEqual([]);
  });
});

describe('collectTimeOff()', () => {
  it('maps valid time-off and drops zero/negative-length entries', () => {
    const timeOff: TimeOffEntity[] = [
      { id: 't1', professionalId: 'pro-1', startAt: utc(2026, 6, 2, 12), endAt: utc(2026, 6, 2, 13), reason: 'Lunch' },
      { id: 't2', professionalId: 'pro-1', startAt: utc(2026, 6, 2, 14), endAt: utc(2026, 6, 2, 14), reason: 'noop' },
    ];
    expect(collectTimeOff(timeOff)).toEqual([
      { start: utc(2026, 6, 2, 12).getTime(), end: utc(2026, 6, 2, 13).getTime() },
    ]);
  });
});

describe('collectAppointmentBusy()', () => {
  it('keeps only blocking statuses (PENDING/CONFIRMED)', () => {
    const busy = collectAppointmentBusy([
      appt('a1', utc(2026, 6, 2, 9), utc(2026, 6, 2, 10), 'CONFIRMED'),
      appt('a2', utc(2026, 6, 2, 10), utc(2026, 6, 2, 11), 'PENDING'),
      appt('a3', utc(2026, 6, 2, 11), utc(2026, 6, 2, 12), 'CANCELLED'),
      appt('a4', utc(2026, 6, 2, 12), utc(2026, 6, 2, 13), 'COMPLETED'),
    ]);
    expect(busy).toHaveLength(2);
  });

  it('excludes the ignored appointment (reschedule case)', () => {
    const busy = collectAppointmentBusy(
      [appt('a1', utc(2026, 6, 2, 9), utc(2026, 6, 2, 10))],
      'a1',
    );
    expect(busy).toEqual([]);
  });
});

describe('buildFreeIntervals()', () => {
  const weekday = utc(2026, 6, 2, 12).getUTCDay();

  it('subtracts a booked appointment from the open hours', () => {
    const free = buildFreeIntervals({
      workingHours: [wh(weekday, 9 * 60, 17 * 60)],
      timeOff: [],
      appointments: [appt('a1', utc(2026, 6, 2, 12), utc(2026, 6, 2, 13))],
      timeZone: 'UTC',
      from: utc(2026, 6, 2),
      to: utc(2026, 6, 2, 23, 59),
    });
    expect(free).toEqual([
      { start: utc(2026, 6, 2, 9).getTime(), end: utc(2026, 6, 2, 12).getTime() },
      { start: utc(2026, 6, 2, 13).getTime(), end: utc(2026, 6, 2, 17).getTime() },
    ]);
  });

  it('honours the minimum lead time by pruning early slots', () => {
    const free = buildFreeIntervals({
      workingHours: [wh(weekday, 9 * 60, 17 * 60)],
      timeOff: [],
      appointments: [],
      timeZone: 'UTC',
      from: utc(2026, 6, 2),
      to: utc(2026, 6, 2, 23, 59),
      now: utc(2026, 6, 2, 10),
      minLeadMinutes: 120, // cannot book before 12:00
    });
    expect(free).toEqual([{ start: utc(2026, 6, 2, 12).getTime(), end: utc(2026, 6, 2, 17).getTime() }]);
  });

  it('clamps to the requested window', () => {
    const free = buildFreeIntervals({
      workingHours: [wh(weekday, 9 * 60, 17 * 60)],
      timeOff: [],
      appointments: [],
      timeZone: 'UTC',
      from: utc(2026, 6, 2, 14),
      to: utc(2026, 6, 2, 16),
    });
    expect(free).toEqual([{ start: utc(2026, 6, 2, 14).getTime(), end: utc(2026, 6, 2, 16).getTime() }]);
  });
});
