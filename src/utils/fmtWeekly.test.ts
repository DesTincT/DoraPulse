import assert from 'node:assert/strict';
import { fmtWeekly } from '../utils.js';

test('fmtWeekly includes week and range label', () => {
  const text = fmtWeekly({
    week: '2026-W01',
    weekRange: { start: '2025-12-29T00:00:00.000Z', end: '2026-01-05T00:00:00.000Z', label: '29.12–04.01' },
    df: { count: 2 },
    prCycleTime: { p50: 0, p90: 0 },
    leadTime: { p50: 0, p90: 0, unit: 'sec', samples: 0 },
    cfr: { numerator: 0, denominator: 0, value: 0 },
    mttr: { p50: 0, p90: 0, incidents: 0 },
    coverage: { leadTime: { prodDeploys: 0, prodDeploysWithSha: 0, commitsResolved: 0 }, incidentsLinked: 0 },
  });
  assert.ok(text.startsWith('📅 Неделя: 2026-W01 (29.12–04.01)'));
});

