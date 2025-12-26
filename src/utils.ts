/**
 * Returns a tuple [from, to) representing the UTC date range for the given ISO week string.
 *
 * @param {string} week - ISO week string in format "YYYY-Www", e.g., "2025-W49"
 * @returns {[Date, Date]} - An array with two Date objects: start (inclusive), end (exclusive)
 */
export function isoWeekRange(week: string) {
  // "2025-W49" -> [2025-12-01, 2025-12-08) UTC
  const [y, w] = week.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const week1 = new Date(jan4);
  week1.setUTCDate(jan4.getUTCDate() - day + 1);
  const from = new Date(week1);
  from.setUTCDate(week1.getUTCDate() + (w - 1) * 7);
  const to = new Date(from);
  to.setUTCDate(from.getUTCDate() + 7);
  return [from, to] as const;
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
  return a[idx];
}

/**
 * Returns an ISO week string (YYYY-Www) representing the last fully completed week.
 *
 * @returns {string} - ISO week string for the previous full week.
 */
export function getLastIsoWeek(): string {
  const now = new Date();
  // Move to last Monday
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // Set to most recent Monday (including today if today is Monday)
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() === 1 ? 7 : (d.getUTCDay() + 6) % 7));
  // Now that we are at last Monday, use ISO week logic
  const y = d.getUTCFullYear();
  const ref = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  ref.setUTCDate(ref.getUTCDate() + 4 - (ref.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(ref.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((ref.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${y}-W${String(weekNo).padStart(2, '0')}`;
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
  const cfrVal = m?.cfr?.value;
  const cfr = cfrVal != null ? `${(cfrVal * 100).toFixed(1)}%` : '—';

  // PR Cycle Time (show — when zeros)
  const prCt50 = fmtDuration(m?.prCycleTime?.p50);
  const prCt90 = fmtDuration(m?.prCycleTime?.p90);

  // DORA Lead Time for Changes (show — when no samples)
  const ltSamples = Number(m?.leadTime?.samples ?? 0);
  const doraLt50 = ltSamples > 0 ? fmtDuration(m?.leadTime?.p50) : '—';
  const doraLt90 = ltSamples > 0 ? fmtDuration(m?.leadTime?.p90) : '—';

  const mttr = fmtDuration(m?.mttr?.p50);

  return [
    `📅 Неделя: ${m?.week ?? '—'}`,
    `🚀 Deployment Frequency: ${df}`,
    `🔁 CFR: ${cfr}`,
    `⏱️ Lead Time for Changes p50/p90: ${doraLt50} / ${doraLt90}`,
    `🔁 PR Cycle Time p50/p90: ${prCt50} / ${prCt90}`,
    `🧯 MTTR p50: ${mttr}`,
  ].join('\n');
}

export function currentIsoWeek() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const tmp = new Date(Date.UTC(y, d.getUTCMonth(), d.getUTCDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const w = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}
