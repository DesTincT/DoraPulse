import assert from 'node:assert/strict';
import test from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';

function setRequiredEnv(mongoUri: string) {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '8082';
  process.env.MONGO_URI = mongoUri;
  process.env.WEBHOOK_SECRET = 'testsecret';
  process.env.VALIDATE_WEBHOOK = 'false';
  process.env.GITHUB_WEBHOOK_VALIDATE = 'false';
  process.env.BOT_TOKEN = 'test';
  process.env.PUBLIC_APP_URL = 'https://example.com';
  process.env.PAK_SALT = 'salt';
  process.env.TIMEZONE = 'UTC';
}

test('webhooks/github: PR model upsert + merged event domain-dedup', async (t) => {
  const mongod = await MongoMemoryServer.create();
  setRequiredEnv(mongod.getUri());

  const { buildServer } = await import('../index.js');
  const { ProjectModel } = await import('../models/Project.js');
  const { RepoModel } = await import('../models/Repo.js');
  const { EventModel } = await import('../models/Event.js');
  const { PullRequestModel } = await import('../models/PullRequest.js');

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

  const opened = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'fixtures', 'pull_request_opened.json'), 'utf8'),
  );
  const closedNotMerged = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'fixtures', 'pull_request_closed_not_merged.json'), 'utf8'),
  );
  const merged = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'fixtures', 'pull_request_merged.json'), 'utf8'),
  );

  const baseHeaders = { 'content-type': 'application/json', 'x-github-event': 'pull_request' };

  // Opened
  const r1 = await fastify.inject({
    method: 'POST',
    url: '/webhooks/github?projectKey=pak',
    headers: { ...baseHeaders, 'x-github-delivery': 'pr-1' },
    payload: opened,
  });
  assert.equal(r1.statusCode, 200);
  let prDoc = await PullRequestModel.findOne({ projectId: project._id, pullRequestId: 9000001 }).lean();
  assert.ok(prDoc);
  assert.equal(prDoc.pullRequestNumber, 101);
  assert.equal(prDoc.repoFullName, 'acme/checkout');
  assert.equal(prDoc.state, 'open');

  // Closed but not merged: updates PR doc, no pr_merged event emitted
  const r2 = await fastify.inject({
    method: 'POST',
    url: '/webhooks/github?projectKey=pak',
    headers: { ...baseHeaders, 'x-github-delivery': 'pr-2' },
    payload: closedNotMerged,
  });
  assert.equal(r2.statusCode, 200);
  const mergedEventsAfter2 = await EventModel.countDocuments({ projectId: project._id, type: 'pr_merged' });
  assert.equal(mergedEventsAfter2, 0);

  // Merged: emits pr_merged and updates PR doc
  const r3 = await fastify.inject({
    method: 'POST',
    url: '/webhooks/github?projectKey=pak',
    headers: { ...baseHeaders, 'x-github-delivery': 'pr-3' },
    payload: merged,
  });
  assert.equal(r3.statusCode, 200);
  const mergedEventsAfter3 = await EventModel.countDocuments({ projectId: project._id, type: 'pr_merged' });
  assert.equal(mergedEventsAfter3, 1);
  prDoc = await PullRequestModel.findOne({ projectId: project._id, pullRequestId: 9000001 }).lean();
  assert.ok(prDoc);
  assert.equal(prDoc.state, 'merged');
  assert.ok(prDoc.mergedAt);

  // Same merged payload again, different delivery => should NOT double-count (domain dedupKey)
  const r4 = await fastify.inject({
    method: 'POST',
    url: '/webhooks/github?projectKey=pak',
    headers: { ...baseHeaders, 'x-github-delivery': 'pr-4' },
    payload: merged,
  });
  assert.equal(r4.statusCode, 200);
  const mergedEventsAfter4 = await EventModel.countDocuments({ projectId: project._id, type: 'pr_merged' });
  assert.equal(mergedEventsAfter4, 1);
});
