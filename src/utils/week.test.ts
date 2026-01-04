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


