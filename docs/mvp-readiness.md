## MVP readiness: data trust (D1–D5)

This document describes the “data trust” rules that Dora Pulse uses to compute weekly metrics and explain “why zeros?” via self-test diagnostics.

### Week selection (ISO week-year + latest complete week)

- **Week key format**: `YYYY-Www` where `YYYY` is the **ISO week-year** (not calendar year).
- **Week range**: Monday 00:00:00.000Z .. Sunday 23:59:59.999Z (UTC).
- **Default week everywhere** (API + bot + Mini App): **latest complete week**.
  - If today is inside an in-progress week, we select the previous ISO week.

Why: it prevents partial-week “zeros” and makes results reproducible across timezones.

### Production deployment rule (DF/CFR)

We derive deployment metrics from **GitHub `deployment_status` webhooks**.

- **DF (Deployment Frequency)** counts only deployment statuses where:
  - the payload has `deployment.environment`
  - the environment matches the project’s production environments rule
  - `deployment_status.state === "success"`
- **CFR (Change Failure Rate)** uses the same prod-environment matching, but treats `state` of `failure` and `error` as failures.

Production environment matching:

- Default: `prod`, `production` (case-insensitive)
- Override: `project.settings.prodEnvironments` can contain strings and/or regex strings:
  - Exact match: `"Prod-EU"`
  - Regex: `"/^prod-.*$/i"` (recommended)

### Webhook idempotency + dedup

To keep metrics correct under retries/redeliveries:

- **Delivery-level dedup**: we use `X-GitHub-Delivery` as a unique delivery id.
  - Stored in `WebhookDelivery` with unique index `(provider=github, deliveryId)`.
  - If the delivery already exists: respond `200 OK` and **skip processing** (no metric changes).

- **Domain-level dedup** (handles different delivery ids for the same logical event):
  - Deployments: `gh:deployment_status:${repoFullName}:${deployment.id}:${deployment_status.id}`
  - PR merges: `gh:pr_merged:${repoFullName}:${pull_request.id}:${merged_at}`
  - Stored as `Event.dedupKey` with unique index `(projectId, dedupKey)`.

### Self-test: “why zeros?”

`GET /projects/:projectId/selftest` returns:

- Week selection: `latestCompleteWeekKey`, `weekKey`, `weekRange`
- Ingestion stats: last webhook time, counts in 15m/24h, duplicates, failures
- Config: effective prod environments, installation/mapping presence
- Data presence (for selected week): merged PRs, matched deploys total, prod deploy successes
- Diagnostic reasons: ordered list of `{code,severity,message,fix}`

Common diagnostic codes:

- `NO_WEBHOOKS_RECENT`: no recent deliveries → likely webhook/app/install issue
- `NO_PROD_DEPLOYS_MATCHED_ENV`: deploy events exist, but environment names don’t match config
- `NO_MERGED_PRS_IN_RANGE`: no merged PRs in the selected week
- `WEEK_SELECTION_MISMATCH`: selected week has no events but latest complete week does
- `INSTALLATION_OR_PERMISSIONS_MISSING`: GitHub installation or repo mapping appears incomplete

### Sample selftest outputs

#### 1) Empty project (no webhooks)

```json
{
  "ok": true,
  "now": "2026-01-04T10:00:00.000Z",
  "latestCompleteWeekKey": "2025-W52",
  "weekKey": "2025-W52",
  "weekRange": {
    "from": "2025-12-22T00:00:00.000Z",
    "to": "2025-12-28T23:59:59.999Z"
  },
  "ingestion": {
    "lastWebhookAt": null,
    "webhooks15m": 0,
    "webhooks24h": 0,
    "duplicates15m": 0,
    "duplicates24h": 0,
    "failures15m": 0,
    "failures24h": 0
  },
  "config": {
    "prodEnvironments": ["prod", "production"],
    "githubInstallationPresent": false,
    "githubReposConfigured": false,
    "repoMappingPresent": false
  },
  "dataPresence": {
    "prsMergedInWeek": 0,
    "deploysInWeekTotal": 0,
    "deploysInWeekProd": 0,
    "lastMergedPrAt": null,
    "lastProdDeployAt": null,
    "deployStatusEventsInWeek": 0
  },
  "diagnosticReasons": [
    {
      "code": "NO_WEBHOOKS_RECENT",
      "severity": "error",
      "message": "No GitHub webhooks received recently (last 24h). Metrics may stay at zero.",
      "fix": "Check webhook/GitHub App installation, permissions, and that GitHub is delivering events to this API."
    }
  ]
}
```

#### 2) Deploys exist, but env does not match prod

```json
{
  "ok": true,
  "now": "2026-01-04T10:00:00.000Z",
  "latestCompleteWeekKey": "2025-W52",
  "weekKey": "2025-W52",
  "weekRange": {
    "from": "2025-12-22T00:00:00.000Z",
    "to": "2025-12-28T23:59:59.999Z"
  },
  "ingestion": {
    "lastWebhookAt": "2026-01-04T09:58:00.000Z",
    "webhooks15m": 3,
    "webhooks24h": 40,
    "duplicates15m": 1,
    "duplicates24h": 5,
    "failures15m": 0,
    "failures24h": 0
  },
  "config": {
    "prodEnvironments": ["prod", "production"],
    "githubInstallationPresent": true,
    "githubReposConfigured": true,
    "repoMappingPresent": true
  },
  "dataPresence": {
    "prsMergedInWeek": 2,
    "deploysInWeekTotal": 0,
    "deploysInWeekProd": 0,
    "lastMergedPrAt": "2025-12-26T12:00:00.000Z",
    "lastProdDeployAt": null,
    "deployStatusEventsInWeek": 6
  },
  "diagnosticReasons": [
    {
      "code": "NO_PROD_DEPLOYS_MATCHED_ENV",
      "severity": "error",
      "message": "Deployment events exist, but none match the configured production environment names.",
      "fix": "Update Production Environments in the Mini App to match your GitHub Environment name(s)."
    }
  ]
}
```
