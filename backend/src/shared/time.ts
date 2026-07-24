/**
 * Timezone-aware time helpers, dependency-free.
 *
 * SmartBooking persists every instant in UTC (Prisma `DateTime` → `timestamptz`).
 * A professional's opening hours, however, are naturally expressed in their local
 * wall-clock time (e.g. "09:00–17:00 Europe/Paris"). These helpers bridge the two
 * without pulling a heavyweight timezone library, by leaning on the platform
 * `Intl.DateTimeFormat`, which ships full IANA tz data.
 */

export const MINUTES_PER_DAY = 1440;
export const MS_PER_MINUTE = 60_000;

/**
 * Offset (ms) between a given instant's UTC value and its wall-clock value in
 * `timeZone`, such that: wallClockAsUTC = instant + offset.
 *
 * Example: for 2026-07-01T10:00:00Z in Europe/Paris (summer, UTC+2) the offset is
 * +2h in ms.
 */
export function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(instant);
  const lookup = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((p) => p.type === type);
    return found ? Number(found.value) : 0;
  };
  const asUTC = Date.UTC(
    lookup('year'),
    lookup('month') - 1,
    lookup('day'),
    lookup('hour'),
    lookup('minute'),
    lookup('second'),
  );
  return asUTC - instant.getTime();
}

/**
 * The calendar date + weekday of an instant, as seen in `timeZone`.
 * weekday: 0 = Sunday ... 6 = Saturday (matching Prisma WorkingHours.weekday).
 */
export function zonedDateParts(
  instant: Date,
  timeZone: string,
): { year: number; month: number; day: number; weekday: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = dtf.formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday: weekdayMap[get('weekday')] ?? 0,
  };
}

/**
 * Convert a local wall-clock time (a calendar day + minutes-from-midnight in
 * `timeZone`) into the corresponding UTC instant.
 *
 * DST note: at the ~1h/year "spring forward" gap this uses the pre-transition
 * offset (documented limitation; professionals do not open at 02:00–03:00).
 */
export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  minutesFromMidnight: number,
  timeZone: string,
): Date {
  const hours = Math.floor(minutesFromMidnight / 60);
  const minutes = minutesFromMidnight % 60;
  const utcGuess = Date.UTC(year, month - 1, day, hours, minutes);
  const offset = timeZoneOffsetMs(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offset);
}

/** Add `days` to an instant (calendar-agnostic, 24h steps). */
export function addDays(instant: Date, days: number): Date {
  return new Date(instant.getTime() + days * MINUTES_PER_DAY * MS_PER_MINUTE);
}
