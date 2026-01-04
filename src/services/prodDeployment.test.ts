import assert from 'node:assert/strict';
import test from 'node:test';
import { matchProdEnvironment, isProdDeployment } from './prodDeployment.js';

test('matchProdEnvironment: defaults are prod|production (case-insensitive)', () => {
  const settings = {};
  assert.equal(matchProdEnvironment('prod', settings), true);
  assert.equal(matchProdEnvironment('PRODUCTION', settings), true);
  assert.equal(matchProdEnvironment('Yandex Cloud', settings), false);
  assert.equal(matchProdEnvironment(undefined, settings), false);
});

test('matchProdEnvironment: override list supports exact strings', () => {
  const settings = { prodEnvironments: ['Yandex Cloud', 'prod-eu'] };
  assert.equal(matchProdEnvironment('yandex cloud', settings), true);
  assert.equal(matchProdEnvironment('PROD-EU', settings), true);
  assert.equal(matchProdEnvironment('production', settings), false);
});

test('matchProdEnvironment: override list supports regex strings', () => {
  const settings = { prodEnvironments: ['/^prod-.*$/i'] };
  assert.equal(matchProdEnvironment('prod-eu', settings), true);
  assert.equal(matchProdEnvironment('Prod-US', settings), true);
  assert.equal(matchProdEnvironment('production', settings), false);
});

test('isProdDeployment: requires deployment_status success + env match', () => {
  const payload = {
    deployment: { environment: 'production' },
    deployment_status: { state: 'success' },
  };
  assert.equal(isProdDeployment(payload, {}), true);

  assert.equal(
    isProdDeployment(
      { deployment: { environment: 'production' }, deployment_status: { state: 'failure' } },
      {},
    ),
    false,
  );
  assert.equal(
    isProdDeployment({ deployment: { environment: 'staging' }, deployment_status: { state: 'success' } }, {}),
    false,
  );
});


