'use strict';
/* eslint-disable no-unused-vars, no-empty */
/* global db, printjson, print */
/**
 * Model cleanup (Stage 1: safe backfills)
 *
 * - Project:
 *   - Backfill settings.github.installationId/accountLogin from legacy locations if missing
 * - Event:
 *   - Backfill meta.prNumber from legacy prId if missing
 *
 * Run with: mongosh <uri> apps-api --file scripts/migrations/0005_model_cleanup.js
 */

// Fallback for environments without printjson (e.g., if executed via Node by mistake)
if (typeof printjson !== 'function') {
  const printjson = function (obj) {
    try {
      if (typeof print === 'function') return print(JSON.stringify(obj));
    } catch (e) {}
    if (typeof console !== 'undefined' && console.log) console.log(obj);
  };
}

function setIfNull(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
    cur = cur[k];
  }
  const last = parts[parts.length - 1];
  if (cur[last] === undefined || cur[last] === null) {
    cur[last] = value;
    return true;
  }
  return false;
}

// --- Projects backfill ---
(function backfillProjects() {
  const coll = db.getCollection('projects');
  const cursor = coll.find(
    {},
    { projection: { settings: 1, github: 1, githubInstallationId: 1, githubAccountLogin: 1 } },
  );
  let updated = 0;
  cursor.forEach((doc) => {
    const srcInstallation =
      (doc.settings && doc.settings.github && typeof doc.settings.github.installationId === 'number'
        ? doc.settings.github.installationId
        : null) ||
      (doc.github && typeof doc.github.installationId === 'number' ? doc.github.installationId : null) ||
      (typeof doc.githubInstallationId === 'number' ? doc.githubInstallationId : null);

    const srcAccountLogin =
      (doc.settings && doc.settings.github && typeof doc.settings.github.accountLogin === 'string'
        ? doc.settings.github.accountLogin
        : null) ||
      (doc.github && typeof doc.github.accountLogin === 'string' ? doc.github.accountLogin : null) ||
      (typeof doc.githubAccountLogin === 'string' ? doc.githubAccountLogin : null);

    const set = {};
    const working = JSON.parse(JSON.stringify(doc));
    if (srcInstallation != null) {
      if (setIfNull(working, 'settings.github.installationId', srcInstallation)) {
        set['settings.github.installationId'] = srcInstallation;
        set['settings.github.updatedAt'] = new Date();
      }
    }
    if (srcAccountLogin != null) {
      if (setIfNull(working, 'settings.github.accountLogin', srcAccountLogin)) {
        set['settings.github.accountLogin'] = srcAccountLogin;
        set['settings.github.updatedAt'] = new Date();
      }
    }
    if (Object.keys(set).length > 0) {
      coll.updateOne({ _id: doc._id }, { $set: set });
      updated++;
    }
  });
  printjson({ projectsBackfilled: updated });
})();

// --- Events backfill ---
(function backfillEvents() {
  const coll = db.getCollection('events');
  const cursor = coll.find({ prId: { $type: 'number' } }, { projection: { prId: 1, meta: 1 } });
  let updated = 0;
  cursor.forEach((doc) => {
    const prId = doc.prId;
    const hasMetaNumber = doc.meta && typeof doc.meta.prNumber === 'number';
    if (typeof prId === 'number' && !hasMetaNumber) {
      coll.updateOne({ _id: doc._id }, { $set: { 'meta.prNumber': prId } });
      updated++;
    }
  });
  printjson({ eventsBackfilled: updated });
})();

// --- Stage 2 suggestions (manual, after deploying fallback reads) ---
// Use with caution and only after ensuring code does not rely on legacy fields.
// db.projects.updateMany({}, { $unset: {
//   githubInstallationId: '',
//   githubInstalledAt: '',
//   githubAccountLogin: '',
//   'github.installationId': '',
//   'github.accountLogin': '',
//   'github.accountType': '',
//   'github.repos': '',
//   'github.updatedAt': ''
// }});
// db.events.updateMany({ prId: { $exists: true } }, { $unset: { prId: '' }});
