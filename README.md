# DoraPulse

TelegramBot monitors for DORA metrics

## Local webapp preview

To preview the Telegram Mini App in a normal browser without Telegram:

1. Start the dev server with DB-less mode and auth bypass:

```bash
npm run dev
```

2. Open the webapp:

```bash
http://localhost:8080/webapp
```

Optional:

- Set a deterministic project id for the preview (used by `/api/*` in bypass mode):

```bash
set DORA_DEV_PROJECT_ID=<mongoObjectId>
```

Notes:

- The Mini App UI is served as static files under `/webapp/*` (with `/webapp` redirecting to `/webapp/`).
- Health check endpoint: `GET /health` returns `{ ok, version, uptime }`.
- In DB-less dev mode (`DORA_DEV_NO_DB=true`), the server does not connect to MongoDB; non-essential routes return 503.
- In dev bypass mode (`DORA_DEV_BYPASS_TELEGRAM_AUTH=true` and `NODE_ENV!=production`), `/api/*` routes accept requests without Telegram headers.
- When no real data exists, responses include sensible defaults for `/api/me`, `/api/envs`, and `/api/selftest`.
