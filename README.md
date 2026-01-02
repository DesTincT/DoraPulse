# DoraPulse

TelegramBot monitors for DORA metrics

Yo!
123
asdasdasd

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

- Set a deterministic project id for the preview:

```bash
set DORA_DEV_PROJECT_ID=<mongoObjectId>
```

Notes:

- In DB-less dev mode, the server does not connect to MongoDB; non-essential routes return 503.
- In dev bypass mode, API routes accept requests without Telegram headers.
- When no real data exists, responses include sensible defaults for `/api/me`, `/api/envs`, and `/api/selftest`.
