import { addWeeks, getISOWeek, getISOWeekYear, startOfISOWeek, subWeeks } from 'date-fns';

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


