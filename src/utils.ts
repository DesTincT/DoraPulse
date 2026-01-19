/**
 * Returns a tuple [from, to) representing the UTC date range for the given ISO week string.
 *
 * @param {string} week - ISO week string in format "YYYY-Www", e.g., "2025-W49"
 * @returns {[Date, Date]} - An array with two Date objects: start (inclusive), end (exclusive)
 */
import {
  getIsoWeekKey,
  getLatestCompleteWeekKey,
  getWeekRangeExclusive,
  getCurrentIsoWeek,
  getIsoWeekDateRange,
  getIsoWeekMinus,
} from './utils/week.js';
import { config } from './config.js';

export function isoWeekRange(week: string) {
  const { from, toExclusive } = getWeekRangeExclusive(week);
  return [from, toExclusive] as const;
}

export function isoWeekString(date: Date): string {
  return getIsoWeekKey(date);
}

/**
 * Computes the p-th percentile value of a numeric array.
 *
 * @param {number[]} arr - The array of numbers.
 * @param {number} p - Percentile to compute (0-100).
 * @returns {number} - The value at the p-th percentile in the sorted array, or 0 if the array is empty.
 */
export function percentile(arr: number[], p: number) {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const idx = Math.floor((p / 100) * (a.length - 1));
  // eslint-disable-next-line security/detect-object-injection
  return a[idx] ?? 0;
}

/**
 * Returns an ISO week string (YYYY-Www) representing the last fully completed week.
 *
 * @returns {string} - ISO week string for the previous full week.
 */
export function getLastIsoWeek(): string {
  // legacy alias: use the shared "latest complete week" rule
  return getLatestCompleteWeekKey(new Date());
}

export function fmtDuration(sec?: number) {
  if (!sec || sec <= 0) return '—';

  if (sec < 60) return `${Math.round(sec)}с`;

  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return s ? `${m}м ${s}с` : `${m}м`;
  }

  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return m ? `${h}ч ${m}м` : `${h}ч`;
}

export function hasAnyData(m: any): boolean {
  if (!m || typeof m !== 'object') return false;
  const totalEvents = Number(m?.debug?.totalEvents ?? 0);
  const dfCount = Number(m?.df?.count ?? 0);
  const cfrDen = Number(m?.cfr?.denominator ?? 0);
  const deploysProd = Number(m?.debug?.deploysProd ?? 0);
  return totalEvents > 0 || dfCount > 0 || cfrDen > 0 || deploysProd > 0;
}

export function fmtWeekly(m: any) {
  if (!hasAnyData(m)) return 'No data yet 🤷‍♂️';

  const df = m?.df?.count ?? 0;
  // TEMP: hide CFR line in bot UI (data trust rollout; can be re-enabled later)
  // const cfrVal = m?.cfr?.value;
  // const cfr = cfrVal != null ? `${(cfrVal * 100).toFixed(1)}%` : '—';

  // PR Cycle Time (show — when zeros)
  const prCt50 = fmtDuration(m?.prCycleTime?.p50);
  const prCt90 = fmtDuration(m?.prCycleTime?.p90);

  // DORA Lead Time for Changes (show — when no samples)
  const ltSamples = Number(m?.leadTime?.samples ?? 0);
  const doraLt50 = ltSamples > 0 ? fmtDuration(m?.leadTime?.p50) : '—';
  const doraLt90 = ltSamples > 0 ? fmtDuration(m?.leadTime?.p90) : '—';

  // TEMP: hide MTTR line in bot UI (can be re-enabled later)
  // const mttr = fmtDuration(m?.mttr?.p50);

  const week = m?.week ?? '—';
  const rangeLabel: string | null =
    (m?.weekRange && typeof m.weekRange.label === 'string' && m.weekRange.label) || null;
  const header = rangeLabel && week ? `📅 ${week} (${rangeLabel})` : `📅 ${week}`;

  return [
    header,
    `🚀 Deployment Frequency: ${df}`,
    // `🔁 CFR: ${cfr}`,
    `⏱️ Lead Time for Changes p50/p90: ${doraLt50} / ${doraLt90}`,
    `🔁 PR Cycle Time p50/p90: ${prCt50} / ${prCt90}`,
    // `🧯 MTTR p50: ${mttr}`,
  ].join('\n');
}

export function currentIsoWeek() {
  return getIsoWeekKey(new Date());
}

// Re-exports for convenience where importing from utils.ts is preferred
export const getCurrentIsoWeekTz = (tz?: string) => getCurrentIsoWeek(tz ?? config.timezone);
export const getIsoWeekDateRangeTz = (week: string, tz?: string) =>
  getIsoWeekDateRange(week, tz ?? config.timezone);
export const getIsoWeekMinusTz = (week: string, n: number) => getIsoWeekMinus(week, n);