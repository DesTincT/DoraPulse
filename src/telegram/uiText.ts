export const uiText = {
  // Menu/buttons
  menu: {
    metrics: '📊 Metrics',
    digest: '🗓 Digest',
    pulse: '📝 Pulse',
    openMiniApp: '🌐 Open Mini‑App',
  },
  // Generic/fallback
  noData: 'No data yet 🤷‍♂️',
  mustStartFirst: 'Run /start first.',
  invalidWeekFormat: 'Format: /metrics or /metrics 2025-W51',
  // /start
  startIntroLines: [
    'Welcome to Dora Pulse.',
    '',
    '1) Open the Mini App (button below) and install the GitHub App.',
    '2) Return here and press Refresh in the Mini App to confirm it’s connected.',
    '3) For GitHub webhook setup/help, run /link.',
  ],
  startProjectInfo: (projectId: string, accessKey: string) => [
    `Project ID: ${projectId}`,
    `Project Key (PAK): ${accessKey}`,
  ],
  startWebhookInfo: (publicUrl: string, accessKey: string, secret: string) => [
    '',
    'Connect GitHub Webhook:',
    `Payload URL: ${publicUrl}/webhooks/github?projectKey=${accessKey}`,
    `Secret: ${secret}`,
    'Events: Pull requests, Pushes, Workflow runs, Deployment status',
    'Content type: application/json',
    '',
    'Metrics appear after merges and production deployments.',
  ],
  // Help
  helpLines: [
    'Available commands:',
    '/link — GitHub webhook instructions',
    '/metrics — metrics for a week',
    '/digest — weekly digest',
    '/pulse — DevEx survey',
    '/webapp — open Mini‑App',
  ],
  // Help: enable DF/CFR via deployment_status events (shown in /help)
  helpDoraDeployHowToLines: [
    'Enable deployment metrics DF/CFR',
    '',
    'Step 1: Create a GitHub Environment',
    'Go to Repository → Settings → Environments and create an environment, e.g. `production`.',
    '',
    'Step 2: Add or edit `.github/workflows/deploy.yml`',
    'Use a workflow that creates a GitHub Deployment and sets deployment status to success/failure.',
    '',
    'Step 3: Verify',
    'Merge a PR to main (or push to main). After the workflow runs, Dora Pulse will start showing DF and CFR.',
  ],
  helpDoraDeployWorkflowYaml: `name: Deploy

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
          token: \${{ github.token }}
          environment: production
          ref: \${{ github.sha }}

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
          token: \${{ github.token }}
          deployment-id: \${{ steps.deployment.outputs.deployment_id }}
          state: success
          auto-inactive: true

      # 3) Mark deployment failure (Dora Pulse -> deploy_failed)
      - name: Mark deployment failure
        if: always() && steps.deployment.outputs.deployment_id != '' && job.status == 'failure'
        uses: chrnorm/deployment-status@v2
        with:
          token: \${{ github.token }}
          deployment-id: \${{ steps.deployment.outputs.deployment_id }}
          state: failure
          auto-inactive: true
`,
  // WebApp
  openMiniAppLabel: 'Open the Mini‑App:',
  webappNeedsHttps: 'WebApp button requires HTTPS.\nTemporarily open this URL or expose HTTPS (e.g. ngrok).',
  // Metrics/digest headings (the content lines come from fmtWeekly)
  weeklyDigestTitle: '📊 Dora Pulse — weekly digest',
  // Pulse
  pulseQuestion: (week: string) => `How was this week for you? (${week})`,
  pulseThanks: (week: string, score: number) => `Thanks! Saved: ${score}/5 for ${week} ✅`,
};
