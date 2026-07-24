import { beforeEach, describe, expect, it } from 'vitest';
import { AppointmentEntity, TimeOffEntity, WorkingHoursEntity } from '../entities';
import { EngineContext, SchedulingEngine } from './scheduling-engine';

const utc = (y: number, mo: number, d: number, h = 0, mi = 0): Date =>
  new Date(Date.UTC(y, mo - 1, d, h, mi));

// Base fixtures anchored to a fixed calendar so tests are deterministic.
const TUE = utc(2026, 6, 2); // reference "Tuesday"
const WED = utc(2026, 6, 3);
const MON_BEFORE = utc(2026, 6, 1, 8); // reference "now", the day before
const tueWeekday = utc(2026, 6, 2, 12).getUTCDay();
const wedWeekday = utc(2026, 6, 3, 12).getUTCDay();

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

const at = (base: Date, h: number, mi = 0): Date =>
  new Date(base.getTime() + (h * 60 + mi) * 60_000);

describe('SchedulingEngine', () => {
  let engine: SchedulingEngine;
  let baseCtx: EngineContext;

  beforeEach(() => {
    engine = new SchedulingEngine({ stepMinutes: 30 });
    baseCtx = {
      workingHours: [wh(tueWeekday, 9 * 60, 17 * 60)],
      timeOff: [],
      appointments: [],
      timeZone: 'UTC',
      now: MON_BEFORE,
      minLeadMinutes: 0,
    };
  });

  it('rejects a non-positive step at construction time', () => {
    expect(() => new SchedulingEngine({ stepMinutes: 0 })).toThrow(RangeError);
  });

  describe('checkAvailability()', () => {
    it('accepts a free slot inside working hours', () => {
      expect(engine.checkAvailability(at(TUE, 10), 30, baseCtx)).toEqual({ available: true });
    });

    it('rejects a slot in the past', () => {
      const result = engine.checkAvailability(at(MON_BEFORE, -2), 30, baseCtx);
      expect(result.reason).toBe('PAST');
    });

    it('rejects a slot that violates the minimum lead time', () => {
      const ctx = { ...baseCtx, now: at(TUE, 9, 30), minLeadMinutes: 120 };
      const result = engine.checkAvailability(at(TUE, 10), 30, ctx);
      expect(result.reason).toBe('LEAD_TIME');
    });

    it('rejects a slot outside working hours', () => {
      const result = engine.checkAvailability(at(TUE, 20), 30, baseCtx);
      expect(result.reason).toBe('OUTSIDE_WORKING_HOURS');
    });

    it('rejects a slot overlapping a time-off period', () => {
      const timeOff: TimeOffEntity[] = [
        { id: 't1', professionalId: 'pro-1', startAt: at(TUE, 13, 30), endAt: at(TUE, 15), reason: 'Break' },
      ];
      const result = engine.checkAvailability(at(TUE, 14), 30, { ...baseCtx, timeOff });
      expect(result.reason).toBe('TIME_OFF');
    });

    it('rejects a slot conflicting with an existing appointment and reports the id', () => {
      const ctx = { ...baseCtx, appointments: [appt('a1', at(TUE, 14), at(TUE, 14, 30))] };
      const result = engine.checkAvailability(at(TUE, 14), 30, ctx);
      expect(result.reason).toBe('CONFLICT');
      expect(result.conflictingAppointmentIds).toEqual(['a1']);
    });

    it('allows booking a slot when the only conflict is the appointment being rescheduled', () => {
      const ctx = {
        ...baseCtx,
        appointments: [appt('a1', at(TUE, 14), at(TUE, 14, 30))],
        ignoreAppointmentId: 'a1',
      };
      expect(engine.checkAvailability(at(TUE, 14), 30, ctx)).toEqual({ available: true });
    });

    it('allows a back-to-back slot immediately after an appointment', () => {
      const ctx = { ...baseCtx, appointments: [appt('a1', at(TUE, 14), at(TUE, 14, 30))] };
      expect(engine.checkAvailability(at(TUE, 14, 30), 30, ctx)).toEqual({ available: true });
    });

    it('throws on a non-positive duration', () => {
      expect(() => engine.checkAvailability(at(TUE, 10), 0, baseCtx)).toThrow(RangeError);
    });
  });

  describe('listAvailableSlots()', () => {
    it('generates a step-aligned grid of slots', () => {
      const ctx = { ...baseCtx, workingHours: [wh(tueWeekday, 9 * 60, 10 * 60)] };
      const slots = engine.listAvailableSlots(TUE, at(TUE, 23, 59), 30, ctx);
      expect(slots.map((s) => s.start.getTime())).toEqual([
        at(TUE, 9).getTime(),
        at(TUE, 9, 30).getTime(),
      ]);
    });

    it('omits slots that do not fully fit before an appointment', () => {
      const ctx = { ...baseCtx, appointments: [appt('a1', at(TUE, 14), at(TUE, 14, 30))] };
      const slots = engine.listAvailableSlots(TUE, at(TUE, 23, 59), 30, ctx);
      const starts = slots.map((s) => s.start.getTime());
      expect(starts).not.toContain(at(TUE, 14).getTime());
      expect(starts).toContain(at(TUE, 13, 30).getTime());
      expect(starts).toContain(at(TUE, 14, 30).getTime());
    });
  });

  describe('suggestAlternatives()', () => {
    it('proposes the nearest slots to the desired time (closest-first)', () => {
      const ctx = { ...baseCtx, appointments: [appt('a1', at(TUE, 14), at(TUE, 14, 30))] };
      const alternatives = engine.suggestAlternatives(at(TUE, 14), 30, ctx, 3);
      expect(alternatives.map((s) => s.start.getTime())).toEqual([
        at(TUE, 13, 30).getTime(), // 30 min before (ties broken earlier-first)
        at(TUE, 14, 30).getTime(), // 30 min after
        at(TUE, 13).getTime(), // 60 min before
      ]);
    });

    it('never returns the exact desired slot as an alternative', () => {
      const alternatives = engine.suggestAlternatives(at(TUE, 10), 30, baseCtx, 3);
      expect(alternatives.map((s) => s.start.getTime())).not.toContain(at(TUE, 10).getTime());
    });

    it('rolls over to the next working day when the day is fully blocked', () => {
      const ctx: EngineContext = {
        ...baseCtx,
        workingHours: [wh(tueWeekday, 9 * 60, 17 * 60), wh(wedWeekday, 9 * 60, 17 * 60)],
        timeOff: [{ id: 't1', professionalId: 'pro-1', startAt: TUE, endAt: WED, reason: 'Closed' }],
      };
      const alternatives = engine.suggestAlternatives(at(TUE, 14), 30, ctx, 1);
      expect(alternatives[0].start.getTime()).toBe(at(WED, 9).getTime());
    });

    it('respects the requested count', () => {
      const alternatives = engine.suggestAlternatives(at(TUE, 10), 30, baseCtx, 5);
      expect(alternatives).toHaveLength(5);
    });
  });

  describe('resolve()', () => {
    it('returns available with no alternatives when the slot is free', () => {
      const result = engine.resolve(at(TUE, 10), 30, baseCtx);
      expect(result.available).toBe(true);
      expect(result.alternatives).toEqual([]);
      expect(result.requested.end.getTime()).toBe(at(TUE, 10, 30).getTime());
    });

    it('returns the reason and alternatives when the slot is taken', () => {
      const ctx = { ...baseCtx, appointments: [appt('a1', at(TUE, 14), at(TUE, 14, 30))] };
      const result = engine.resolve(at(TUE, 14), 30, ctx, 3);
      expect(result.available).toBe(false);
      expect(result.reason).toBe('CONFLICT');
      expect(result.alternatives).toHaveLength(3);
      expect(result.alternatives[0].start.getTime()).toBe(at(TUE, 13, 30).getTime());
    });
  });
});
