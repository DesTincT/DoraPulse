<div align="center">

# Dora Pulse

“DORA metrics in Telegram — automated weekly delivery health, right where your team is.”

[Demo — TODO] • [GitHub App — TODO] • [Issues](https://github.com/DesTincT/DoraPulse/issues) • [Roadmap — TODO]

<br/>

![License](https://img.shields.io/github/license/DesTincT/DoraPulse)
![Node](https://img.shields.io/badge/node-20.x-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-5.x-3178C6?logo=typescript&logoColor=white)
![Docker Compose](https://img.shields.io/badge/docker-compose-blue?logo=docker&logoColor=white)
![CI](https://github.com/DesTincT/DoraPulse/actions/workflows/deploy.yml/badge.svg?branch=main)

</div>

Dora Pulse brings DORA metrics to Telegram. It integrates with GitHub, computes weekly delivery health, and posts clear updates right into your team’s chat — with a minimal web Mini App for setup. Designed for small/mid teams, engineering leads, and product/eng managers.

---

## Table of Contents

- [Features](#features)
- [Metrics](#metrics)
- [Screenshots](#screenshots)
- [How it works](#how-it-works)
- [Quickstart (local)](#quickstart-local)
- [Installation / Setup (production)](#installation--setup-production)
- [Usage](#usage)
- [Configuration](#configuration)
- [Security & privacy](#security--privacy)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- Telegram bot commands: `/help`, `/metrics`, `/digest`, `/pulse` (rating 1–5 with aggregation)
- GitHub App integration to ingest delivery signals (PRs, deployments)
- Mini App for initial setup (production environment rules, linking)
- Weekly cron digest every Monday at 09:00 in TIMEZONE (default Europe/Moscow)
- ISO week aware (correct around New Year, Monday-start week)
- Production environment matching rules (strings or regex) configured in Mini App

---

## Metrics

Weekly, ISO‑week aligned (Mon–Sun):

- Deployment Frequency (DF): number of distinct production deployments within the week.
- Change Failure Rate (CFR): failed/(failed+successful) production deployments within the week.
- Lead Time for Changes: commit → production deploy latency (p50; p90 shown when enough samples).
- PR Cycle Time: time from PR opened to PR merged (p50; p90 shown when enough samples).
- MTTR: time from incident opened to resolved (p50; p90 available in API).

All metrics are computed per ISO week (Mon–Sun) in your configured `TIMEZONE`.

Notes:

- Production environments are matched by rules (strings/regex) set in the Mini App.
- p90 is omitted when the sample size is too low to be meaningful.

---

## Screenshots

Add your screenshots under `./assets` and update these placeholders:

![Telegram report](./assets/telegram-report.png)
![Mini App](./assets/miniapp.png)

See: [assets/README.md](./assets/README.md)

---

## How it works

1. Install/start the Telegram bot and create/select a project (`/start`).
2. Install the GitHub App and select repositories to ingest events.
3. In the Mini App, set your production environment names/rules.
4. Dora Pulse aggregates events into weekly DORA signals, posts updates, and sends an automated Monday digest.

---

## Quickstart (local)

Prerequisites:

- Node.js 20+
- Docker + Docker Compose (recommended) or local MongoDB

Clone and run API locally:

```bash
npm ci
npm run build
npm run start:dev
```

Environment (from `src/config.ts`):

```bash
# required
PORT=8080
MONGO_URI=mongodb://127.0.0.1:27017/dora_pulse
WEBHOOK_SECRET=your_webhook_secret
BOT_TOKEN=your_telegram_bot_token
PUBLIC_APP_URL=https://your-public-app-url.example.com
PAK_SALT=some_random_salt
TIMEZONE=Europe/Moscow

# optional
GITHUB_APP_SLUG=your_app_slug
GITHUB_API_TOKEN=ghp_xxx
GITHUB_TOKEN=ghp_xxx
```

Prefer Docker Compose? Use your existing compose setup (or create one) to run API + MongoDB; set the same env variables for the `api` container.

---

## Installation / Setup (production)

Recommended: Docker Compose on a VM.

- Provision a VM with Docker/Compose.
- Set environment variables (see above) for the API container.
- Expose the API over HTTPS (reverse proxy or cloud load balancer).
- Configure Telegram bot token and GitHub App secrets as environment variables.

CI/CD:

- This repo contains a GitHub Actions workflow (`deploy.yml`) that builds the project and ships artifacts to a VM.
- It restarts the `api` service via Docker Compose and performs a basic healthcheck.

Deployment notes (optional):

- The build produces a `dist/` bundle for the API. Ensure volumes or image builds mount/include `dist/`.
- The Mini App (web) static is served by the API plugin routing; no separate SPA build is required in this repo.

---

## Usage

In Telegram (in your project chat):

- `/help` — 5‑step setup guide (concise).
- `/metrics` — current ISO week metrics (with date range label).
- `/digest` — weekly dynamics: compares current ISO week vs previous week; shows DF, CFR, Lead Time p50 (p90 when available), PR Cycle p50 (and p90 if meaningful), MTTR p50, with deltas.
- `/pulse` — prompts a 1..5 rating. The bot upserts your rating for the current week and prints aggregated results (n, average, counts per 1..5).

Notes:

- ISO week/year safe across New Year (week starts Monday).
- If a week has no data, outputs are handled gracefully and remain compact.

---

## Configuration

- `TIMEZONE` (default `Europe/Moscow`): used for all cron schedules and “current week” computations.
- Production environment rules (strings or regex) are configurable in the Mini App (settings). They determine which deployments are considered production for DF/CFR and Lead Time.
- Percentiles rule: p90 is shown when sufficient samples exist (the bot/UI omits p90 when sample size is too low to be meaningful).

---

## Security & privacy

- No source code ingestion. Dora Pulse only uses GitHub webhooks and stores delivery-related metadata required to compute metrics.
- Do not treat this as a compliance solution; handle your own secrets management and network policies.

---

## Troubleshooting

- Webhooks not arriving
  - Verify GitHub App installation on the project.
  - Check that your API endpoint is reachable and `WEBHOOK_SECRET` matches.
  - Look at the self-test endpoint in the Mini App to diagnose ingestion.

- Wrong week number around New Year (ISO week)
  - Dora Pulse uses ISO‑8601 week numbering (Monday start) and week-year rollover.
  - If your timezone is unusual, ensure `TIMEZONE` is correctly set.

- 502 during deploy warmup
  - The container may be restarting or warming caches; check the API `/health` endpoint and the compose logs.

---

## Contributing

We welcome contributions!

1. Fork the repo and create a feature branch.
2. Make changes with tests where practical.
3. Lint & test:
   ```bash
   npm run lint
   npm test
   ```
4. Open a Pull Request.

### Project AI standards

- Please follow the project guidelines documented at `.cursor/rules/project-standards.mdc`.
- Keep PRs small and focused; ensure CI passes (lint, build, tests).

---

## License

This project uses the license declared in the repository (see `LICENSE`).  
If `LICENSE` is missing, please file an issue — TODO to add an explicit license file.

# Dora Pulse

Dora Pulse is a Telegram bot + Telegram Mini App that tracks DORA-style metrics for your projects.

Today the key metrics are:

- **Deployment Frequency (DF)**: computed from GitHub `deployment_status` events
- **Change Failure Rate (CFR)**: computed from failed `deployment_status` events
- **Lead Time for Changes**: time from commit to successful deployment to production.
- **PR Cycle Time**: computation uses PR events: `pr_open` and `pr_merged`

This package (`apps/api`) contains:

- A **Fastify API** (serves `/api/*` and webhooks)
- A **Telegraf bot** (polling)
- A **static Telegram Mini App** served under `/webapp/`

## Run locally

1. Install deps

```bash
npm install
```

2. Create `.env` (or use `prod.env` as a template) and set at least:

- `PORT`
- `MONGO_URI` (unless using DB-less mode)
- `PUBLIC_APP_URL` (must be a public HTTPS URL for Telegram WebApp)
- `BOT_TOKEN`
- `WEBHOOK_SECRET`
- `PAK_SALT`
- `TIMEZONE`

3. Start dev server

```bash
npm run dev
```

Health check:

- `GET /health` → `{ ok, version, uptime }`

## Telegram Mini App basics

The Mini App must be opened **from Telegram** to provide `initData` (Telegram WebApp auth header).

- Use the bot’s **inline “Open Dora Pulse”** WebApp button.
- If you open `/webapp/` directly in a browser, `/api/*` will respond with `open_in_telegram`.

## Local Mini App preview (no Telegram)

To preview the UI in a normal browser without Telegram:

1. Start the dev server with DB-less mode and auth bypass.

PowerShell:

```bash
$env:DORA_DEV_NO_DB="true"
$env:DORA_DEV_BYPASS_TELEGRAM_AUTH="true"
npm run dev
```

2. Open:

```bash
http://localhost:8080/webapp/
```

Optional:

- Set a deterministic project id for the preview (used by `/api/*` in bypass mode):

```bash
$env:DORA_DEV_PROJECT_ID="<mongoObjectId>"
```

Notes:

- The Mini App UI is served as static files under `/webapp/*`.
- `GET /webapp` and `GET /webapp/` both return **200** (no redirect), to avoid breaking Telegram WebView `initData`.
- In DB-less dev mode (`DORA_DEV_NO_DB=true`), the server does not connect to MongoDB; non-essential routes return 503.
- In dev bypass mode (`DORA_DEV_BYPASS_TELEGRAM_AUTH=true` and `NODE_ENV!=production`), `/api/*` routes accept requests without Telegram headers.

## Mini App performance & native UX

The Mini App uses an **Instant HTML App Shell** (not SSR) and a single **bootstrap** request for the first screen.

- **App Shell (no SSR)**: `webapp/index.html` contains a static skeleton + critical CSS + a micro-script that applies Telegram `themeParams` before React mounts.
- **Bootstrap**: the UI reads cached bootstrap from `localStorage` (TTL 30–60 min) and updates from `GET /api/bootstrap` in the background.
- **Perf marks (dev-only)**: `app_start`, `first_shell`, `bootstrap_cache_hit`, `bootstrap_loaded`, `interactive` are logged in dev console for quick checks.
- **Server caching**: templates for static caching are in `docs/nginx-webapp.conf` and `docs/caddy-webapp.Caddyfile`.
- **Settings row pattern**: the right side is always a single element (action button OR status pill), never both.

Targets:

- First visual shell in < 100–200 ms.
- One request for the first screen (`/api/bootstrap`).
- Instant repeat opens (shell + cached bootstrap).

## GitHub App install flow (Mini App “Install” status)

If you configure a GitHub App for Dora Pulse, the Mini App shows whether it’s installed for the current Telegram project.

Required env:

- `GITHUB_APP_SLUG` (the `https://github.com/apps/<slug>` part)

GitHub App settings:

- Set **Setup URL / Callback URL** to:
  - `https://<PUBLIC_APP_URL>/github/app/setup`

Mini App behavior:

- `/api/me` returns `github: { installed, installationId }` and `githubInstallUrl`
- After GitHub redirects back to `/webapp/`, the UI auto-refreshes status when the WebView regains focus

## Enable Deployment metrics (DORA): Deployment Frequency (DF) + Change Failure Rate (CFR)

Dora Pulse calculates **DF** and **CFR** from **GitHub Deployment Status events**.

To make GitHub emit these events, add a workflow that:

- Creates a GitHub Deployment (Production environment)
- Runs your actual deploy logic
- Marks the deployment status as success or failure

### 1) Create a GitHub Environment

Go to **Repository → Settings → Environments** and create an environment, e.g.:

- `production` (recommended)

Make sure the environment name matches what you use in the workflow.

### 2) Add/Edit the workflow file

Create: `.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  push:
    branches: ['main'] # your_choice

concurrency:
  group: deploy-main # your_choice
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest # your_choice

    # Required so GitHub allows creating deployments + setting statuses
    permissions:
      contents: read
      deployments: write

    steps:
      # --- YOUR CI / BUILD / CHECKOUT HERE ---
      - name: YOUR_CI_BUILD_CHECKOUT_HERE
        run: |
          echo "Run checkout/build/tests here if needed."

      # 1) Create GitHub Deployment (this triggers deployment_status events)
      - name: Create deployment
        id: deployment
        uses: chrnorm/deployment-action@v2
        with:
          token: ${{ github.token }}
          environment: production
          ref: ${{ github.sha }}

      # --- YOUR REAL DEPLOY HERE ---
      # This step must exit with non-zero code if deploy fails
      - name: YOUR_DEPLOY_ACTION_HERE
        run: |
          echo "Deploy your app here (VM / Kubernetes / Cloud / etc.)"

      # 2) Mark deployment success (Dora Pulse -> deploy_succeeded)
      - name: Mark deployment success
        if: always() && steps.deployment.outputs.deployment_id != '' && job.status == 'success'
        uses: chrnorm/deployment-status@v2
        with:
          token: ${{ github.token }}
          deployment-id: ${{ steps.deployment.outputs.deployment_id }}
          state: success
          auto-inactive: true

      # 3) Mark deployment failure (Dora Pulse -> deploy_failed)
      - name: Mark deployment failure
        if: always() && steps.deployment.outputs.deployment_id != '' && job.status == 'failure'
        uses: chrnorm/deployment-status@v2
        with:
          token: ${{ github.token }}
          deployment-id: ${{ steps.deployment.outputs.deployment_id }}
          state: failure
          auto-inactive: true
```

If you don’t use `production` as the environment name, replace it with your environment name (and add it to Dora Pulse **“Production Environments”** in the Mini App if needed).

### 3) Verify

1. Merge a PR to `main` (or push to `main`)
2. The workflow runs and emits `deployment_status` events
3. Dora Pulse bot starts showing:
   - **Deployment Frequency (DF)**
   - **Change Failure Rate (CFR)**
