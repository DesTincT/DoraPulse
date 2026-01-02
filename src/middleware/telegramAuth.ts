import { FastifyRequest, FastifyReply } from 'fastify';
import { createHmac, timingSafeEqual } from 'crypto';
import { ProjectModel } from '../models/Project.js';
import { config } from '../config.js';

type TelegramValidationReason =
  | 'missing_init_data'
  | 'missing_hash'
  | 'hash_mismatch'
  | 'expired_auth_date'
  | 'bad_auth_date'
  | 'exception';

function isTrueish(val: string | undefined): boolean {
  if (!val) return false;
  const v = val.toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

function getInitData(req: FastifyRequest): string {
  const h1 = req.headers['x-telegram-init-data'];
  const h2 = req.headers['x-telegram-webapp-initdata'];
  const fromHeader = (typeof h1 === 'string' ? h1 : undefined) || (typeof h2 === 'string' ? h2 : undefined);
  if (typeof fromHeader === 'string') return fromHeader;
  const fromQuery = (req.query as any)?.initData;
  if (typeof fromQuery === 'string') return fromQuery;
  const fromBody = (req.body as any)?.initData;
  if (typeof fromBody === 'string') return fromBody;
  return '';
}

function validateTelegramInitData(
  rawInitData: string,
): { ok: true; data: Record<string, string> } | { ok: false; reason: TelegramValidationReason; message: string } {
  try {
    const raw = typeof rawInitData === 'string' ? rawInitData : '';
    if (!raw) return { ok: false, reason: 'missing_init_data', message: 'x-telegram-init-data is missing/empty' };

    const params = new URLSearchParams(raw);
    const hash = params.get('hash');
    if (!hash) return { ok: false, reason: 'missing_hash', message: 'hash is missing from init data' };

    // Build data_check_string from all keys except hash, sorted by key, as `key=value` joined with \n
    const entries: [string, string][] = [];
    for (const [k, v] of params.entries()) {
      if (k === 'hash') continue;
      entries.push([k, v]);
    }
    entries.sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

    // Telegram WebApp validation:
    // secret_key = HMAC_SHA256("WebAppData", BOT_TOKEN) (raw bytes)
    // calc_hash = HMAC_SHA256(secret_key, data_check_string).digest("hex")
    const secretKey = createHmac('sha256', 'WebAppData').update(config.botToken).digest();
    const calcHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const left = Buffer.from(calcHash, 'hex');
    const right = Buffer.from(hash, 'hex');
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      return { ok: false, reason: 'hash_mismatch', message: 'init data hash mismatch' };
    }

    // Optional freshness check (24h)
    const authDateRaw = params.get('auth_date');
    if (authDateRaw) {
      const authDate = Number(authDateRaw);
      if (!Number.isFinite(authDate) || authDate <= 0) {
        return { ok: false, reason: 'bad_auth_date', message: 'auth_date is not a valid unix timestamp' };
      }
      const nowSec = Math.floor(Date.now() / 1000);
      if (nowSec - authDate > 24 * 60 * 60) {
        return { ok: false, reason: 'expired_auth_date', message: 'auth_date is older than 24h' };
      }
    }

    const data: Record<string, string> = {};
    for (const [k, v] of params.entries()) {
      // eslint-disable-next-line security/detect-object-injection
      data[k] = v;
    }
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, reason: 'exception', message: e?.message || 'exception while validating init data' };
  }
}

function debugInitData(req: FastifyRequest) {
  const init = String(req.headers['x-telegram-init-data'] ?? '');
  const prefix = init ? `${init.slice(0, 40)}${init.length > 40 ? '…' : ''}` : '';
  return { present: !!init, len: init.length, prefix };
}

export async function telegramAuthOptional(req: FastifyRequest, _reply: FastifyReply) {
  // DEV-only bypass for local webapp preview (explicit opt-in)
  const shouldDevBypass = process.env.NODE_ENV !== 'production' && isTrueish(process.env.DORA_DEV_BYPASS_TELEGRAM_AUTH);
  if (shouldDevBypass) {
    req.devBypass = true;
    const noDb = isTrueish(process.env.DORA_DEV_NO_DB);
    const devProjectId = process.env.DORA_DEV_PROJECT_ID;

    // In DB-less dev mode, never touch Mongo; use a stable in-memory project.
    if (noDb) {
      req.project = {
        _id: devProjectId || 'dev',
        name: 'dev_project',
        github: {},
        settings: {
          prodRule: { branch: 'main', workflowNameRegex: 'deploy.*prod' },
          ltBaseline: 'pr_open',
          github: {},
        },
      };
      return;
    }

    if (devProjectId) {
      // Lightweight in-memory project reference (no DB required)
      req.project = {
        _id: devProjectId,
        name: 'dev_project',
        github: {},
        settings: {
          prodRule: { branch: 'main', workflowNameRegex: 'deploy.*prod' },
          ltBaseline: 'pr_open',
          github: {},
        },
      };
      return;
    }
    // Fallback: find or create a deterministic dev project in DB
    let project = await ProjectModel.findOne({ name: 'dev_project' });
    if (!project) {
      project = await new ProjectModel({
        name: 'dev_project',
        chatId: 0,
        accessKey: Math.random().toString(36).slice(2, 11),
        settings: { prodRule: { branch: 'main', workflowNameRegex: 'deploy.*prod' }, ltBaseline: 'pr_open' },
      } as any).save();
    }
    req.project = project;
    return;
  }

  const initData = getInitData(req);
  const v = validateTelegramInitData(initData);
  if (!v.ok) {
    req.telegramAuthError = { reason: v.reason, message: v.message };
    return;
  }

  const chatJson = v.data?.chat ? JSON.parse(v.data.chat) : null;
  const chatId: number | undefined = chatJson?.id ?? (v.data?.user ? JSON.parse(v.data.user)?.id : undefined);
  if (!chatId) {
    req.telegramAuthError = { reason: 'exception', message: 'chat id missing' };
    return;
  }

  let project = await ProjectModel.findOne({ chatId });
  if (!project) {
    const created = await new ProjectModel({
      name: `project-${chatId}`,
      chatId,
      accessKey: Math.random().toString(36).slice(2, 11),
      settings: { prodRule: { branch: 'main', workflowNameRegex: 'deploy.*prod' }, ltBaseline: 'pr_open' },
    } as any).save();
    project = created;
  }

  req.project = project;
}

export async function telegramAuth(req: FastifyRequest, reply: FastifyReply) {
  await telegramAuthOptional(req, reply);
  if (req.project) return;

  // strict: if optional didn't attach a project, reject
  const dbg = debugInitData(req);
  req.log.info({ telegramInitData: dbg, authError: req.telegramAuthError }, 'telegram auth failed');

  return reply.code(401).send({
    ok: false,
    error: 'open_in_telegram',
    reason: req.telegramAuthError?.reason || 'invalid_init_data',
    message: 'Open this Mini App from Telegram.',
  });
}
