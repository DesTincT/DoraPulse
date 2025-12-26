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
  startIntroLines: ['👋 Hi! I’m Dora Pulse bot.', 'I collect GitHub events and show weekly DORA metrics.', ''],
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
  // WebApp
  openMiniAppLabel: 'Open the Mini‑App:',
  webappNeedsHttps: 'WebApp button requires HTTPS.\nTemporarily open this URL or expose HTTPS (e.g. ngrok).',
  // Metrics/digest headings (the content lines come from fmtWeekly)
  weeklyDigestTitle: '📊 Dora Pulse — weekly digest',
  // Pulse
  pulseQuestion: (week: string) => `How was this week for you? (${week})`,
  pulseThanks: (week: string, score: number) => `Thanks! Saved: ${score}/5 for ${week} ✅`,
};
