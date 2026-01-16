import assert from 'node:assert/strict';
import { getIsoWeekDateRange } from './week.js';
import { formatInTimeZone } from 'date-fns-tz';

const TZ = 'Europe/Berlin';

function isoWeekFor(dateIso: string, tz = TZ): string {
  // Using formatInTimeZone to derive ISO week-year for a specific date/time
  const d = new Date(dateIso);
  return formatInTimeZone(d, tz, "RRRR-'W'II");
}

test('ISO week-year rollover: 2026-01-01 is 2026-W01 (Europe/Berlin)', () => {
  const w = isoWeekFor('2026-01-01T12:00:00Z', TZ);
  assert.equal(w, '2026-W01');
});

test('ISO week-year rollover: 2025-12-31 is 2026-W01 (Europe/Berlin)', () => {
  const w = isoWeekFor('2025-12-31T12:00:00Z', TZ);
  assert.equal(w, '2026-W01');
});

test('getIsoWeekDateRange label for 2026-W01 (Europe/Berlin)', () => {
  const r = getIsoWeekDateRange('2026-W01', TZ);
  assert.equal(r.label, '29.12–04.01');
  // sanity: dates are ISO strings
  assert.ok(typeof r.startDate.toISOString() === 'string');
  assert.ok(typeof r.endDate.toISOString() === 'string');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { getIsoWeekKey, getLatestCompleteWeekKey, getWeekRange } from './week.js';

test('getIsoWeekKey: ISO week-year boundary 2025-12-29..2026-01-04 => 2026-W01', () => {
  const dates = [
    '2025-12-29T00:00:00Z',
    '2025-12-30T12:00:00Z',
    '2025-12-31T23:59:59Z',
    '2026-01-01T00:00:00Z',
    '2026-01-03T23:59:59Z',
    '2026-01-04T12:00:00Z',
  ].map((s) => new Date(s));
  for (const d of dates) {
    assert.equal(getIsoWeekKey(d), '2026-W01');
  }
});

test('getWeekRange: 2026-W01 is Monday..Sunday UTC inclusive', () => {
  const { from, to } = getWeekRange('2026-W01');
  assert.equal(from.toISOString(), '2025-12-29T00:00:00.000Z');
  assert.equal(to.toISOString(), '2026-01-04T23:59:59.999Z');
});

test('getLatestCompleteWeekKey: returns previous week until Sunday is complete (UTC)', () => {
  // Fri Jan 2, 2026 is within 2026-W01, which isn't complete yet => latest complete is 2025-W52
  assert.equal(getLatestCompleteWeekKey(new Date('2026-01-02T12:00:00Z')), '2025-W52');
  // Mon Jan 5, 2026 means 2026-W01 has completed => latest complete is 2026-W01
  assert.equal(getLatestCompleteWeekKey(new Date('2026-01-05T00:00:00Z')), '2026-W01');
});
