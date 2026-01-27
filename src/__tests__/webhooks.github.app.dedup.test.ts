import assert from 'node:assert/strict';
import test from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function setRequiredEnv(mongoUri: string) {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '8084';
  process.env.MONGO_URI = mongoUri;
  process.env.WEBHOOK_SECRET = 'testsecret';
  process.env.GITHUB_APP_WEBHOOK_SECRET = 'testsecret';
  process.env.VALIDATE_WEBHOOK = 'false';
  process.env.GITHUB_WEBHOOK_VALIDATE = 'false';
  process.env.BOT_TOKEN = 'test';
  process.env.PUBLIC_APP_URL = 'https://example.com';
  process.env.PAK_SALT = 'salt';
  process.env.TIMEZONE = 'UTC';
}

function signGithubAppWebhook(body: any, secret: string): string {
  const raw = Buffer.from(JSON.stringify(body));
  const digest = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  return `sha256=${digest}`;
}

test('webhooks/github/app: delivery idempotency does not conflict on seenCount', async (t) => {
  const mongod = await MongoMemoryServer.create();
  setRequiredEnv(mongod.getUri());

  const { buildServer } = await import('../index.js');
  const { ProjectModel } = await import('../models/Project.js');
  const { RepoModel } = await import('../models/Repo.js');
  const { EventModel } = await import('../models/Event.js');
  const { WebhookDeliveryModel } = await import('../models/WebhookDelivery.js');

  const fastify = await buildServer({ mongoUri: mongod.getUri() });
  t.after(async () => {
    await fastify.close();
    await mongoose.disconnect();
    await mongod.stop();
  });

  const installationId = 424242;
  const project = await ProjectModel.create({
    name: 'p',
    chatId: 1,
    accessKey: 'pak',
    settings: {
      prodRule: { branch: 'main', workflowNameRegex: 'deploy.*prod' },
      ltBaseline: 'pr_open',
      prodEnvironments: ['Yandex Cloud'],
      github: { installationId, updatedAt: new Date() },
    },
  });
  await RepoModel.create({ projectId: project._id, owner: 'acme', name: 'checkout', defaultBranch: 'main' });

  const payload = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'fixtures', 'deployment_status_success.json'), 'utf8'),
  );
  payload.installation = { id: installationId };

  const deliveryId = 'app-d-1';
  const headers = {
    'content-type': 'application/json',
    'x-github-event': 'deployment_status',
    'x-github-delivery': deliveryId,
    'x-hub-signature-256': signGithubAppWebhook(payload, 'testsecret'),
  };

  const r1 = await fastify.inject({ method: 'POST', url: '/webhooks/github/app', headers, payload });
  assert.equal(r1.statusCode, 200);

  const eventsAfter1 = await EventModel.countDocuments({ projectId: project._id });
  assert.equal(eventsAfter1, 1);

  const r2 = await fastify.inject({ method: 'POST', url: '/webhooks/github/app', headers, payload });
  assert.equal(r2.statusCode, 200);
  assert.deepEqual(r2.json(), { ok: true, duplicate: true });

  const eventsAfter2 = await EventModel.countDocuments({ projectId: project._id });
  assert.equal(eventsAfter2, 1);

  const delivery = await WebhookDeliveryModel.findOne({ provider: 'github', deliveryId }).lean();
  assert.ok(delivery);
  assert.equal(delivery.seenCount, 2);
});
