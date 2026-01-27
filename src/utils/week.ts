import { addWeeks, getISOWeek, getISOWeekYear, startOfISOWeek, subWeeks, addDays, parse } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

function asUtcForDateFns(date: Date): Date {
  // date-fns ISO week helpers use the Date's local timezone.
  // Shift the timestamp so "local time" == UTC time, making week boundaries stable across deployments.
  return new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
}

export function getIsoWeekKey(date: Date): string {
  const d = asUtcForDateFns(date);
  const y = getISOWeekYear(d);
  const w = getISOWeek(d);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

export function getWeekRange(weekKey: string): { from: Date; to: Date } {
  // weekKey: "YYYY-Www" => Monday 00:00:00.000Z .. Sunday 23:59:59.999Z
  const [y, w] = weekKey.split('-W').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(w)) throw new Error(`Invalid weekKey: ${weekKey}`);

  const jan4 = new Date(Date.UTC(y, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const week1 = new Date(jan4);
  week1.setUTCDate(jan4.getUTCDate() - day + 1);

  const from = new Date(week1);
  from.setUTCDate(week1.getUTCDate() + (w - 1) * 7);

  const toExclusive = new Date(from);
  toExclusive.setUTCDate(from.getUTCDate() + 7);
  const to = new Date(toExclusive.getTime() - 1);

  return { from, to };
}

export function getWeekRangeExclusive(weekKey: string): { from: Date; toExclusive: Date } {
  const { from, to } = getWeekRange(weekKey);
  return { from, toExclusive: new Date(to.getTime() + 1) };
}

export function getLatestCompleteWeekKey(now: Date = new Date()): string {
  // "latest complete week" per Mon..Sun: if current week isn't complete yet, return previous ISO week.
  const d = asUtcForDateFns(now);
  const startThisWeek = startOfISOWeek(d);
  const startNextWeek = addWeeks(startThisWeek, 1);
  if (d.getTime() >= startNextWeek.getTime()) {
    const y = getISOWeekYear(startThisWeek);
    const w = getISOWeek(startThisWeek);
    return `${y}-W${String(w).padStart(2, '0')}`;
  }
  const startPrevWeek = subWeeks(startThisWeek, 1);
  const y = getISOWeekYear(startPrevWeek);
  const w = getISOWeek(startPrevWeek);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

export function getPreviousWeekKey(weekKey: string): string {
  const { from } = getWeekRangeExclusive(weekKey);
  // one millisecond before this week starts is guaranteed to be in the previous ISO week
  return getIsoWeekKey(new Date(from.getTime() - 1));
}

/**
 * Return current ISO week key for the given timezone.
 * Uses ISO week-year so year transitions are correct (e.g., 2026-W01).
 */
export function getCurrentIsoWeek(tz: string): string {
  // date-fns tokens:
  // RRRR — ISO week-numbering year, II — ISO week of year (01..53)
  return formatInTimeZone(new Date(), tz, "RRRR-'W'II");
}

/**
 * Returns Monday..Sunday range and a human label for a given ISO week in a timezone.
 * - startDate: Monday 00:00 (UTC)
 * - endDate: next Monday 00:00 (UTC) — exclusive
 * - label: "DD.MM–DD.MM" formatted in tz
 */
export function getIsoWeekDateRange(weekKey: string, tz: string): { startDate: Date; endDate: Date; label: string } {
  const [yStr, wStr] = weekKey.split('-W');
  const y = Number(yStr);
  const w = Number(wStr);
  if (!Number.isFinite(y) || !Number.isFinite(w)) throw new Error(`Invalid weekKey: ${weekKey}`);

  // For UTC boundaries we keep the canonical UTC Mon..Mon [from, toExclusive)
  const { from: startDate, toExclusive: endDate } = getWeekRangeExclusive(weekKey);

  // Labels should reflect calendar dates in the target timezone.
  // Using UTC boundaries directly can roll over to Monday in some TZs (e.g., Europe/Berlin, Jan).
  // Derive the end label from startDate + 6 days to get Sunday in the target TZ reliably.
  const startLabel = formatInTimeZone(startDate, tz, 'dd.MM');
  const endLabel = formatInTimeZone(addDays(startDate, 6), tz, 'dd.MM');
  const label = `${startLabel}–${endLabel}`;

  return { startDate, endDate, label };
}

/**
 * Subtract n ISO weeks from a given week key.
 */
export function getIsoWeekMinus(weekKey: string, n: number): string {
  if (!Number.isFinite(n) || n <= 0) return weekKey;
  const { from } = getWeekRangeExclusive(weekKey);
  const d = new Date(from.getTime() - n * 7 * 24 * 60 * 60 * 1000);
  return getIsoWeekKey(d);
}
