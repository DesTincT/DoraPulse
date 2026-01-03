# Dora Pulse (API)

Dora Pulse is a Telegram bot + Telegram Mini App that tracks DORA-style metrics for your projects.

Today the key metrics are:

- **Deployment Frequency (DF)**: computed from GitHub `deployment_status` events
- **Change Failure Rate (CFR)**: computed from failed `deployment_status` events

This package (`apps/api`) contains:

- A **Fastify API** (serves `/api/*` and webhooks)
- A **Telegraf bot** (polling)
- A **static Telegram Mini App** served under `/webapp/`

## Run locally

1) Install deps

```bash
npm install
```

2) Create `.env` (or use `prod.env` as a template) and set at least:

- `PORT`
- `MONGO_URI` (unless using DB-less mode)
- `PUBLIC_APP_URL` (must be a public HTTPS URL for Telegram WebApp)
- `BOT_TOKEN`
- `WEBHOOK_SECRET`
- `PAK_SALT`
- `TIMEZONE`

3) Start dev server

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

1) Start the dev server with DB-less mode and auth bypass.

PowerShell:

```bash
$env:DORA_DEV_NO_DB="true"
$env:DORA_DEV_BYPASS_TELEGRAM_AUTH="true"
npm run dev
```

2) Open:

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
    branches: ["main"]  # your_choice

concurrency:
  group: deploy-main        # your_choice
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest  # your_choice

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

1) Merge a PR to `main` (or push to `main`)
2) The workflow runs and emits `deployment_status` events
3) Dora Pulse bot starts showing:
   - **Deployment Frequency (DF)**
   - **Change Failure Rate (CFR)**
