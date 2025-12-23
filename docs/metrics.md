## Metrics: PR Cycle Time vs DORA Lead Time

This service now distinguishes between PR Cycle Time (a PR-centered proxy) and the true DORA Lead Time for Changes.

- PR Cycle Time (aka PR Lead Time): time from PR creation/open to PR merge.
  - Field: `prCycleTime { p50, p90 }` (seconds)
  - Computation uses PR events: `pr_open` and `pr_merged` (legacy `pr_merge` supported).
  - This is NOT a DORA metric; it reflects code review cycle length.

- DORA Lead Time for Changes: time from commit to successful deployment to production.
  - Field: `leadTime { p50, p90 } | null` (seconds)
  - We build samples by matching production deploy events to the deployed commit sha(s) and subtracting the commit timestamp (from GitHub) from the deploy completion time.
  - Strict “no data” policy: if there are zero production deploy events with commit linkage in the week, `leadTime` is `null`. We never fall back to PR Cycle Time.

### Coverage

`coverage.leadTime` clarifies sample availability:
```json
{
  "prodDeploys": 3,
  "prodDeploysWithSha": 1,
  "commitsResolved": 1
}
```

If `prodDeploysWithSha` is 0, expect `leadTime: null`.

### Telegram/Formatting

Weekly text shows:
- PR Cycle Time p50/p90 from PRs
- DORA Lead Time p50/p90 or “N/A — need prod deploy SHA linkage”

### Data Requirements

- Production deploy events must carry `meta.env = "prod"` and `meta.sha` (or `meta.shas`) plus `meta.repoFullName`.
- Commit timestamps are fetched from GitHub (`GET /repos/{owner}/{repo}/commits/{sha}`) and cached in Mongo (`Commit` collection) to avoid repeated lookups.


