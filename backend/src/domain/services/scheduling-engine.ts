/**
 * SmartBooking — Smart Scheduling Engine.
 *
 * The differentiating feature of the product. Given a professional's schedule and
 * a desired appointment, it:
 *   1. detects conflicts (double-booking, time-off, outside opening hours, lead time);
 *   2. lists all bookable slots for a window;
 *   3. proposes the nearest alternative slots when the desired time is taken.
 *
 * The engine is a **pure domain service**: no I/O, no `Date.now()` hidden inside
 * (the reference "now" is injected), so every branch is deterministically testable.
 */
import { AppointmentEntity, BLOCKING_STATUSES } from '../entities';
import { contains, interval, mergeIntervals, overlaps } from '../value-objects/interval';
import { MINUTES_PER_DAY, MS_PER_MINUTE } from '../../shared/time';
import {
  AvailabilityContext,
  buildFreeIntervals,
  collectTimeOff,
  expandWorkingHours,
} from './availability.service';

export type UnavailabilityReason =
  | 'PAST'
  | 'LEAD_TIME'
  | 'OUTSIDE_WORKING_HOURS'
  | 'TIME_OFF'
  | 'CONFLICT';

export interface AvailabilityResult {
  available: boolean;
  reason?: UnavailabilityReason;
  /** Present when reason === 'CONFLICT'. */
  conflictingAppointmentIds?: string[];
}

export interface Slot {
  start: Date;
  end: Date;
}

export interface EngineContext extends AvailabilityContext {
  /** Reference instant for "past"/lead-time checks. */
  now?: Date;
  /** Minimum notice in minutes before an appointment can start. */
  minLeadMinutes?: number;
}

export interface EngineOptions {
  /** Slot granularity when generating candidate slots (minutes). */
  stepMinutes?: number;
}

export interface ResolveResult extends AvailabilityResult {
  requested: Slot;
  /** Nearest bookable alternatives, only populated when not available. */
  alternatives: Slot[];
}

const DAY_MS = MINUTES_PER_DAY * MS_PER_MINUTE;

export class SchedulingEngine {
  private readonly stepMinutes: number;

  constructor(options: EngineOptions = {}) {
    this.stepMinutes = options.stepMinutes ?? 15;
    if (this.stepMinutes <= 0) {
      throw new RangeError('stepMinutes must be a positive number');
    }
  }

  /**
   * Check whether a precise slot (desiredStart + durationMinutes) can be booked,
   * returning a granular reason when it cannot.
   */
  checkAvailability(
    desiredStart: Date,
    durationMinutes: number,
    ctx: EngineContext,
  ): AvailabilityResult {
    if (durationMinutes <= 0) {
      throw new RangeError('durationMinutes must be a positive number');
    }
    const startMs = desiredStart.getTime();
    const endMs = startMs + durationMinutes * MS_PER_MINUTE;
    const desired = interval(startMs, endMs);

    const now = (ctx.now ?? new Date()).getTime();
    if (startMs < now) return { available: false, reason: 'PAST' };
    const lead = (ctx.minLeadMinutes ?? 0) * MS_PER_MINUTE;
    if (startMs < now + lead) return { available: false, reason: 'LEAD_TIME' };

    // Within opening hours? (look a day either side so the containing interval is complete)
    const open = mergeIntervals(
      expandWorkingHours(ctx.workingHours, ctx.timeZone, new Date(startMs - DAY_MS), new Date(endMs + DAY_MS)),
    );
    if (!open.some((o) => contains(o, desired))) {
      return { available: false, reason: 'OUTSIDE_WORKING_HOURS' };
    }

    // Time-off?
    if (collectTimeOff(ctx.timeOff).some((t) => overlaps(t, desired))) {
      return { available: false, reason: 'TIME_OFF' };
    }

    // Conflicting appointments?
    const conflicts = ctx.appointments.filter(
      (a: AppointmentEntity) =>
        a.id !== ctx.ignoreAppointmentId &&
        BLOCKING_STATUSES.includes(a.status) &&
        overlaps({ start: a.startAt.getTime(), end: a.endAt.getTime() }, desired),
    );
    if (conflicts.length > 0) {
      return {
        available: false,
        reason: 'CONFLICT',
        conflictingAppointmentIds: conflicts.map((c) => c.id),
      };
    }

    return { available: true };
  }

  /**
   * All bookable start times for a service of `durationMinutes` within `[from, to]`.
   * Candidates are generated on a `stepMinutes` grid inside each free interval.
   */
  listAvailableSlots(
    from: Date,
    to: Date,
    durationMinutes: number,
    ctx: EngineContext,
  ): Slot[] {
    if (durationMinutes <= 0) {
      throw new RangeError('durationMinutes must be a positive number');
    }
    const free = buildFreeIntervals({
      ...ctx,
      from,
      to,
      now: ctx.now,
      minLeadMinutes: ctx.minLeadMinutes,
    });
    const durationMs = durationMinutes * MS_PER_MINUTE;
    const stepMs = this.stepMinutes * MS_PER_MINUTE;
    const slots: Slot[] = [];
    for (const f of free) {
      for (let s = f.start; s + durationMs <= f.end; s += stepMs) {
        slots.push({ start: new Date(s), end: new Date(s + durationMs) });
      }
    }
    return slots;
  }

  /**
   * Propose the `count` nearest bookable slots to `desiredStart`, searching up to
   * `searchWindowDays` ahead. Slots are ranked by absolute distance to the desired
   * start (earlier ties win), which yields the "closest available" behaviour users expect.
   */
  suggestAlternatives(
    desiredStart: Date,
    durationMinutes: number,
    ctx: EngineContext,
    count = 3,
    searchWindowDays = 14,
  ): Slot[] {
    const now = ctx.now ?? new Date();
    const from = new Date(Math.max(desiredStart.getTime() - DAY_MS, now.getTime()));
    const to = new Date(desiredStart.getTime() + searchWindowDays * DAY_MS);

    const candidates = this.listAvailableSlots(from, to, durationMinutes, ctx);
    const target = desiredStart.getTime();

    return candidates
      .filter((slot) => slot.start.getTime() !== target)
      .sort((a, b) => {
        const da = Math.abs(a.start.getTime() - target);
        const db = Math.abs(b.start.getTime() - target);
        return da === db ? a.start.getTime() - b.start.getTime() : da - db;
      })
      .slice(0, count);
  }

  /**
   * One-shot resolution used by the booking API: is the desired slot free? If not,
   * why, and what are the nearest alternatives?
   */
  resolve(
    desiredStart: Date,
    durationMinutes: number,
    ctx: EngineContext,
    count = 3,
  ): ResolveResult {
    const requested: Slot = {
      start: desiredStart,
      end: new Date(desiredStart.getTime() + durationMinutes * MS_PER_MINUTE),
    };
    const check = this.checkAvailability(desiredStart, durationMinutes, ctx);
    if (check.available) {
      return { ...check, requested, alternatives: [] };
    }
    return {
      ...check,
      requested,
      alternatives: this.suggestAlternatives(desiredStart, durationMinutes, ctx, count),
    };
  }
}
