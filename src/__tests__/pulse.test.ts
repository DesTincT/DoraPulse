import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PulseResponseModel } from '../models/PulseResponse.js';
import { ProjectModel } from '../models/Project.js';

test('PulseResponse upsert: overwrite rating for same (projectId, week, userId)', async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  try {
    const project = await ProjectModel.create({
      name: 'p',
      chatId: 1,
      accessKey: 'pak',
      settings: { prodRule: { branch: 'main', workflowNameRegex: 'deploy.*prod' }, ltBaseline: 'pr_open' },
    });
    const pid = project._id;
    const week = '2026-W01';
    const userId = 12345;

    const now = new Date();
    await PulseResponseModel.updateOne(
      { projectId: pid, week, userId },
      { $set: { rating: 3, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
    await PulseResponseModel.updateOne(
      { projectId: pid, week, userId },
      { $set: { rating: 5, updatedAt: new Date(now.getTime() + 1000) } },
      { upsert: true },
    );

    const all = await PulseResponseModel.find({ projectId: pid, week }).lean();
    assert.equal(all.length, 1);
    assert.equal(all[0].rating, 5);
    assert.equal(all[0].userId, userId);
  } finally {
    await mongoose.disconnect();
    await mongod.stop();
  }
});
