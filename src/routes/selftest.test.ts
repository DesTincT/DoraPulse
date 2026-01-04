import assert from 'node:assert/strict';
import test from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

function setRequiredEnv(mongoUri: string) {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '8083';
  process.env.MONGO_URI = mongoUri;
  process.env.WEBHOOK_SECRET = 'testsecret';
  process.env.VALIDATE_WEBHOOK = 'false';
  process.env.GITHUB_WEBHOOK_VALIDATE = 'false';
  process.env.BOT_TOKEN = 'test';
  process.env.PUBLIC_APP_URL = 'https://example.com';
  process.env.PAK_SALT = 'salt';
  process.env.TIMEZONE = 'UTC';
}

test('GET /projects/:projectId/selftest returns diagnostics and required fields', async (t) => {
  const mongod = await MongoMemoryServer.create();
  setRequiredEnv(mongod.getUri());

  const { buildServer } = await import('../index.js');
  const { ProjectModel } = await import('../models/Project.js');
  const { RepoModel } = await import('../models/Repo.js');

  const fastify = await buildServer({ mongoUri: mongod.getUri() });
  t.after(async () => {
    await fastify.close();
    await mongoose.disconnect();
    await mongod.stop();
  });

  const project = await ProjectModel.create({
    name: 'p',
    chatId: 1,
    accessKey: 'pak',
    settings: {
      prodRule: { branch: 'main', workflowNameRegex: 'deploy.*prod' },
      ltBaseline: 'pr_open',
      prodEnvironments: ['production'],
    },
  });
  await RepoModel.create({ projectId: project._id, owner: 'acme', name: 'checkout', defaultBranch: 'main' });

  const res = await fastify.inject({
    method: 'GET',
    url: `/projects/${String(project._id)}/selftest`,
  });
  assert.equal(res.statusCode, 200);
  const body: any = res.json();
  assert.equal(body.ok, true);
  assert.ok(typeof body.now === 'string');
  assert.ok(typeof body.latestCompleteWeekKey === 'string');
  assert.ok(typeof body.weekKey === 'string');
  assert.ok(body.weekRange && typeof body.weekRange.from === 'string' && typeof body.weekRange.to === 'string');
  assert.ok(body.ingestion && typeof body.ingestion.webhooks15m === 'number');
  assert.ok(body.config && Array.isArray(body.config.prodEnvironments));
  assert.ok(body.dataPresence && typeof body.dataPresence.prsMergedInWeek === 'number');
  assert.ok(Array.isArray(body.diagnosticReasons));
});


