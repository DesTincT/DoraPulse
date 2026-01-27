## DB Model Audit (MVP scope)

### High-level findings

- GitHub installation fields are duplicated across three locations: `settings.github.installationId`, top-level `github.installationId`, and top-level `githubInstallationId`.
- Event schema mixes legacy and canonical fields: `type` supports both `pr_merge` and `pr_merged`; PR identifiers live both in `prId` and `meta.prNumber`; deployment environment is canonical in `meta.deploymentEnvironment` but `env` is also present for some sources.
- `WeeklyMetrics` collection exists but is not used by runtime code; metrics are computed on the fly.
- `Commit` model is currently unused; `CommitCache` is used for lead-time resolution.
- `PulseResponse` model is defined, but `/pulse/answer` route is effectively disabled; no writes/reads in runtime.
- Several code paths already implement backward-compat reading (falling back across duplicated fields); safe cleanup is feasible in two stages.
- Index coverage is generally OK; consider an additional partial index for Event `meta.deploymentEnvironment` if filtering shifts server-side.

---

### Models and fields

#### Project

Fields:

- `name: string (required)`
- `chatId: number (required)`
- `accessKey: string (required)`
- `settings.prodRule.branch: string (required)`
- `settings.prodRule.workflowNameRegex: string (required)`
- `settings.ltBaseline: 'pr_open' | 'first_commit' (required)`
- `settings.prodEnvironments?: string[]`
- `settings.github.installationId?: number`
- `settings.github.accountLogin?: string`
- `settings.github.accountType?: 'User' | 'Organization'`
- `settings.github.repos?: string[]`
- `settings.github.updatedAt?: Date`
- `github.installationId?: number` (legacy dup)
- `github.accountLogin?: string` (legacy dup)
- `github.accountType?: 'User' | 'Organization'` (legacy dup)
- `github.repos?: string[]` (legacy dup)
- `github.updatedAt?: Date` (legacy dup)
- `githubInstallationId?: number` (legacy dup)
- `githubInstalledAt?: Date` (legacy dup)
- `githubAccountLogin?: string` (legacy dup)

Writes:

- Create on `/start` and telegram auth bootstrap.
- Update GitHub install on `routes/githubAppCallback.ts` (`$set` multiple duplicates), `routes/webhooks.github.app.ts` (lookup).
- Update `settings.prodEnvironments` on `routes/webapp.ts` POST `/api/envs`.

Reads:

- Many routes read `settings.prodEnvironments`, `settings.prodRule.branch`, and GitHub installation via fallback in `middleware/telegramAuth.ts` and `routes/webhooks.github.app.ts`.

Use:

- `settings.*` are Active.
- Top-level `github*` duplicates: Active (for compatibility) but should be migrated -> legacy.

Recommendation:

- Canonicalize to `settings.github.*` for install/account fields.
- Keep `settings.prodEnvironments` as canonical.
- Remove top-level `githubInstallationId`, `github*` after staged migration.
- Consider adding an index on `settings.github.installationId` (sparse) if used for direct lookups.

Risk of removing legacy: Medium (fallbacks exist, but ensure all readers updated first).

---

#### Event

Fields:

- `ts: Date (required)`
- `source: 'github' | 'manual' (required)`
- `type: 'pr_open' | 'pr_merge' | 'pr_merged' | 'commit' | 'deploy_succeeded' | 'deploy_failed' | 'incident_open' | 'incident_resolved' (required)`
- `projectId: ObjectId (required, index)`
- `repoId: ObjectId (required, index)`
- `actor?: string`
- `branch?: string`
- `tag?: string`
- `sha?: string`
- `prId?: number` (legacy)
- `env?: 'prod' | 'stage' | null` (aux)
- `meta: Mixed { prNumber?, repoFullName?, deploymentEnvironment?, env?, ... }`
- `bodyPreview?: string (<=300)`
- `dedupKey?: string (unique with partial filter)`

Writes:

- In webhooks normalizers: `services/githubNormalizer.ts` for PRs, deployments, pushes (sets `meta.*`, `dedupKey`).

Reads:

- Metrics use `type`, `meta.deploymentEnvironment`, `meta.repoFullName`, `meta.sha`, fallback to legacy `env`, `prId` in `services/metricsService.ts`.
- Selftest counts and filters by `type` and `meta.deploymentEnvironment`.
- UI env discovery uses `distinct('meta.deploymentEnvironment')`.

Use:

- Canonical fields: `type`, `ts`, `meta.deploymentEnvironment`, `meta.repoFullName`, `meta.prNumber`.
- Legacy: `prId`, `pr_merge`, top-level `env`.

Recommendation:

- Standardize `type` to `pr_merged` (keep reading `pr_merge` for a deprecation period).
- Migrate `prId` -> `meta.prNumber` where missing.
- Prefer `meta.deploymentEnvironment`; keep `env` only as UI/auxiliary.
- Consider a partial index on `{ 'meta.deploymentEnvironment': 1, projectId: 1, ts: 1 }` if server-side matching grows.

Risk of removing legacy: Medium.

---

#### WebhookDelivery

Fields:

- `provider: 'github' (required)`
- `deliveryId: string (required, unique index)`
- `projectId?: ObjectId (index)`
- `installationId?: number`
- `repoFullName?: string`
- `eventName?: string`
- `firstSeenAt: Date (required)`
- `lastSeenAt: Date (required)`
- `seenCount: number (required, default 1)`
- `status: 'received' | 'processed' | 'duplicate' | 'queued' | 'failed' (required, default 'received')`
- `processedAt?: Date`
- `error?: string`

Writes:

- On webhook receipt/upsert and during processing result updates (`routes/webhooks.github*.ts`).

Reads:

- Selftest counts recent deliveries and last seen. Dedup tests check `seenCount`.

Use: Active. No duplication issues.

Recommendation:

- Keep as is.

Risk: Low.

---

#### Incident

Fields:

- `projectId: ObjectId (required)`
- `service: string (required)`
- `openedAt: Date (required)`
- `resolvedAt?: Date|null`
- `title: string (required)`
- `description: string (required)`
- `severity: 'SEV1' | 'SEV2' | 'SEV3' (required)`

Writes:

- By external incidents import/create endpoints (planned); used by MTTR computation.

Reads:

- `services/metricsService.ts` for MTTR and counts.

Use: Active for MTTR input.

Recommendation: Keep. Consider optional index on `{ projectId, openedAt }`.

Risk: Low.

---

#### PullRequest

Fields:

- `projectId: ObjectId (required, index)`
- `repoFullName: string (required)`
- `installationId?: number`
- `pullRequestId: number (required, unique with projectId/repoFullName)`
- `pullRequestNumber: number (required)`
- `createdAt: Date (required)`
- `mergedAt?: Date`
- `closedAt?: Date`
- `baseBranch?: string`
- `headBranch?: string`
- `url?: string`
- `state: 'open' | 'closed' | 'merged' (required)`
- `updatedAt: Date (required)`

Writes:

- `services/pullRequestService.ts` via `upsertPullRequest`.

Reads:

- Minimal currently (signals in selftest only indirectly).

Use: Active (ingestion), but not yet powering UI.

Recommendation: Keep. Add queries later as needed.

Risk: Low.

---

#### CommitCache

Fields:

- `repoFullName: string (required, unique with sha)`
- `sha: string (required)`
- `committedAt: Date (required)`
- `fetchedAt: Date (required)`

Writes:

- `services/metricsService.ts` when resolving commit times from GitHub.

Reads:

- Same service for caching lookups.

Use: Active.

Recommendation: Keep. Consider TTL on `fetchedAt` later.

Risk: Low.

---

#### Commit

Fields:

- `projectId: ObjectId (required)`
- `repoFullName: string (required)`
- `sha: string (required)`
- `ts: Date (required)`

Writes/Reads:

- Not referenced in current runtime code.

Use: Dead (MVP).

Recommendation: Remove or park for vNext. Risk: Low.

---

#### Repo

Fields:

- `projectId: ObjectId (required)`
- `owner: string (required)`
- `name: string (required)`
- `defaultBranch: string (required, default 'main')`

Writes:

- Created on project bootstrap in bot/tests.

Reads:

- Limited (tests; future mapping).

Use: Active (light).

Recommendation: Keep.

Risk: Low.

---

#### WeeklyMetrics

Fields: aggregate metrics per repo/week.

Writes/Reads:

- Not used by current services/routes.

Use: Dead (MVP).

Recommendation: Remove or implement caching using this model in vNext. Risk: Low.

---

### Duplications and inconsistencies

- GitHub installation duplication:
  - `settings.github.installationId` (canonical target)
  - `github.installationId` (legacy)
  - `githubInstallationId` (legacy)
- PR identification:
  - Legacy `prId` vs canonical `meta.prNumber` in Event documents.
- Event type:
  - Legacy `pr_merge` vs canonical `pr_merged` (code already supports both).
- Environment naming:
  - Canonical `meta.deploymentEnvironment`; auxiliary `meta.env` (prod/stage) and top-level `env` exist; code prefers `meta.deploymentEnvironment`.

Fields written but not read:

- Project: `githubInstalledAt`, `githubAccountLogin` (rarely/never read; UI computes from `req.project` context).

Fields read but not written:

- None critical; some legacy reads exist only for compatibility.

Potential update conflicts:

- WebhookDelivery `seenCount` uses `$inc` on upsert path; current logic is consistent.

---

### Canonical MVP data model (vNext)

- Project (canonical):
  - `name`, `chatId`, `accessKey`
  - `settings.prodRule.branch`, `settings.prodRule.workflowNameRegex`, `settings.ltBaseline`
  - `settings.prodEnvironments: string[]`
  - `settings.github.installationId`, `settings.github.accountLogin`, `settings.github.updatedAt`, `settings.github.repos?`
  - Remove: top-level `github*` duplicates after migration
- Event (canonical):
  - `type` (use `pr_merged`), `ts`, `projectId`, `repoId`
  - `meta.deploymentEnvironment`, `meta.repoFullName`, `meta.prNumber`, `meta.sha`, `meta.branch`, optional `meta.env`, `meta.bodyPreview`
  - Remove: `prId`, top-level `env` after migration period
- Keep WebhookDelivery, Incident, PullRequest, CommitCache, Repo unchanged.
- Remove `WeeklyMetrics`, `Commit` unless implementing their usage.

---

### Migration plan

Stage 1 (safe):

- Backfill canonical fields if missing:
  - In `Project`: set `settings.github.installationId` and `settings.github.accountLogin` from legacy locations if null.
  - In `Event`: set `meta.prNumber` from `prId` if missing.
- Ensure code always reads canonical first (already implemented for most flows).
- Deploy with fallback reads intact.

Stage 2 (cleanup):

- Remove legacy fields:
  - `Project`: unset `githubInstallationId`, `githubInstalledAt`, `githubAccountLogin`, and `github.*` duplicates.
  - `Event`: unset `prId`; standardize `type='pr_merged'` for PR merges (optional backfill).
- Optionally drop `WeeklyMetrics` and `Commit` collections (or leave for vNext).

---

### Appendix: File references (selected)

- Project reads/writes:
  - `src/middleware/telegramAuth.ts` (fallback mapping)
  - `src/routes/githubAppCallback.ts` (writes install fields)
  - `src/routes/webapp.ts` (envs update)
  - `src/routes/webhooks.github.app.ts` (lookup by installationId)
- Event processing:
  - `src/services/githubNormalizer.ts`
  - `src/services/metricsService.ts`
  - `src/services/selftestService.ts`
  - `src/routes/webapp.ts` (env discovery)
