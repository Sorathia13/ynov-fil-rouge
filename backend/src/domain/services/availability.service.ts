/**
 * Availability service — turns a professional's recurring schedule, time-off and
 * existing appointments into concrete free/busy {@link Interval}s over a window.
 *
 * This is the only place where wall-clock ↔ UTC conversion happens; everything
 * downstream (the {@link SchedulingEngine}) reasons on pure numeric intervals.
 */
import {
  AppointmentEntity,
  BLOCKING_STATUSES,
  TimeOffEntity,
  WorkingHoursEntity,
} from '../entities';
import { Interval, overlaps, subtractIntervals } from '../value-objects/interval';
import {
  MINUTES_PER_DAY,
  MS_PER_MINUTE,
  zonedDateParts,
  zonedWallTimeToUtc,
} from '../../shared/time';

export interface AvailabilityContext {
  workingHours: WorkingHoursEntity[];
  timeOff: TimeOffEntity[];
  appointments: AppointmentEntity[];
  /** IANA timezone of the professional, e.g. "Europe/Paris". */
  timeZone: string;
  /** Appointment to ignore (used when rescheduling an existing booking). */
  ignoreAppointmentId?: string;
}

export interface FreeIntervalsInput extends AvailabilityContext {
  from: Date;
  to: Date;
  /** Reference "now"; slots before now (+ lead) are pruned. Defaults to `from`. */
  now?: Date;
  /** Minimum booking notice in minutes. */
  minLeadMinutes?: number;
}

/**
 * Expand the recurring weekly working hours into concrete UTC intervals covering
 * `[from, to]` in the professional's timezone.
 */
export function expandWorkingHours(
  workingHours: readonly WorkingHoursEntity[],
  timeZone: string,
  from: Date,
  to: Date,
): Interval[] {
  const result: Interval[] = [];
  if (workingHours.length === 0) return result;

  const startParts = zonedDateParts(from, timeZone);
  // Anchor at 12:00 UTC of the first local day so ±1h DST drift never skips a day.
  let anchor = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day, 12));
  const guard = to.getTime() + MINUTES_PER_DAY * MS_PER_MINUTE;

  while (anchor.getTime() <= guard) {
    const parts = zonedDateParts(anchor, timeZone);
    for (const wh of workingHours) {
      if (wh.weekday !== parts.weekday) continue;
      if (wh.endMinute <= wh.startMinute) continue;
      const start = zonedWallTimeToUtc(parts.year, parts.month, parts.day, wh.startMinute, timeZone);
      const end = zonedWallTimeToUtc(parts.year, parts.month, parts.day, wh.endMinute, timeZone);
      if (end.getTime() > start.getTime()) {
        result.push({ start: start.getTime(), end: end.getTime() });
      }
    }
    anchor = new Date(anchor.getTime() + MINUTES_PER_DAY * MS_PER_MINUTE);
  }
  return result;
}

/** Time-off periods as busy intervals. */
export function collectTimeOff(timeOff: readonly TimeOffEntity[]): Interval[] {
  return timeOff
    .filter((t) => t.endAt.getTime() > t.startAt.getTime())
    .map((t) => ({ start: t.startAt.getTime(), end: t.endAt.getTime() }));
}

/** Blocking appointments (PENDING/CONFIRMED) as busy intervals. */
export function collectAppointmentBusy(
  appointments: readonly AppointmentEntity[],
  ignoreAppointmentId?: string,
): Interval[] {
  return appointments
    .filter(
      (a) =>
        a.id !== ignoreAppointmentId &&
        BLOCKING_STATUSES.includes(a.status) &&
        a.endAt.getTime() > a.startAt.getTime(),
    )
    .map((a) => ({ start: a.startAt.getTime(), end: a.endAt.getTime() }));
}

/** All busy intervals (time-off + blocking appointments). */
export function buildBusyIntervals(ctx: AvailabilityContext): Interval[] {
  return [...collectTimeOff(ctx.timeOff), ...collectAppointmentBusy(ctx.appointments, ctx.ignoreAppointmentId)];
}

/**
 * Compute the free intervals within `[from, to]`: open working hours minus busy
 * periods, clamped to the window and to the minimum booking lead time.
 */
export function buildFreeIntervals(input: FreeIntervalsInput): Interval[] {
  const open = expandWorkingHours(input.workingHours, input.timeZone, input.from, input.to);
  const busy = buildBusyIntervals(input);

  const now = input.now ?? input.from;
  const floor = now.getTime() + (input.minLeadMinutes ?? 0) * MS_PER_MINUTE;
  const windowStart = Math.max(input.from.getTime(), floor);
  const windowEnd = input.to.getTime();

  const free: Interval[] = [];
  for (const o of open) {
    const start = Math.max(o.start, windowStart);
    const end = Math.min(o.end, windowEnd);
    if (end <= start) continue;
    const relevantBusy = busy.filter((b) => overlaps(b, { start, end }));
    free.push(...subtractIntervals({ start, end }, relevantBusy));
  }
  return free.sort((a, b) => a.start - b.start);
}
