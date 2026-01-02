import { FastifyRequest, FastifyReply } from 'fastify';
import { createHmac, createHash, timingSafeEqual } from 'crypto';
import { ProjectModel } from '../models/Project.js';
import { config } from '../config.js';

interface TelegramInitData {
  query_id?: string;
  user?: string;
  chat?: string;
  auth_date?: string;
  hash?: string;
  [k: string]: string | undefined;
}

function isTrueish(val: string | undefined): boolean {
  if (!val) return false;
  const v = val.toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

function parseInitData(raw?: string): TelegramInitData | null {
  if (!raw || typeof raw !== 'string') return null;
  const params = new URLSearchParams(raw);
  const out: TelegramInitData = {};
  const allowed = ['query_id', 'user', 'chat', 'auth_date', 'hash'] as const;
  for (const key of allowed) {
    const v = params.get(key);
    // eslint-disable-next-line security/detect-object-injection
    if (v != null) (out as Record<string, string>)[key] = v;
  }
  return out;
}

function validateTelegramInitData(raw?: string): { ok: boolean; data?: TelegramInitData } {
  try {
    const parsed = parseInitData(raw);
    if (!parsed) return { ok: false };
    const hash = parsed['hash'] || '';
    const keys: (keyof TelegramInitData)[] = ['auth_date', 'chat', 'query_id', 'user'];
    const pairs: string[] = [];
    for (const k of keys) {
      // eslint-disable-next-line security/detect-object-injection
      const v = parsed[k];
      if (typeof v === 'string') pairs.push(`${k}=${v}`);
    }
    const dataCheckString = pairs.join('\n');
    const secret = createHash('sha256').update(config.botToken).digest();
    const hmac = createHmac('sha256', secret).update(dataCheckString).digest('hex');
    const left = Buffer.from(hmac, 'hex');
    const right = Buffer.from(hash, 'hex');
    if (left.length !== right.length || !timingSafeEqual(left, right)) return { ok: false };
    return { ok: true, data: parsed };
  } catch {
    return { ok: false };
  }
}

export async function telegramAuth(req: FastifyRequest, reply: FastifyReply) {
  // DEV-only bypass for local webapp preview (explicit opt-in)
  const shouldDevBypass = process.env.NODE_ENV !== 'production' && isTrueish(process.env.DORA_DEV_BYPASS_TELEGRAM_AUTH);
  if (shouldDevBypass) {
    (req as any).devBypass = true;
    const noDb = isTrueish(process.env.DORA_DEV_NO_DB);
    const devProjectId = process.env.DORA_DEV_PROJECT_ID;

    // In DB-less dev mode, never touch Mongo; use a stable in-memory project.
    if (noDb) {
      (req as any).project = {
        _id: devProjectId || 'dev',
        name: 'dev_project',
        github: {},
        settings: { prodRule: { branch: 'main', workflowNameRegex: 'deploy.*prod' }, ltBaseline: 'pr_open' },
      };
      return;
    }

    if (devProjectId) {
      // Lightweight in-memory project reference (no DB required)
      (req as any).project = {
        _id: devProjectId,
        name: 'dev_project',
        github: {},
        settings: { prodRule: { branch: 'main', workflowNameRegex: 'deploy.*prod' }, ltBaseline: 'pr_open' },
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
    (req as any).project = project;
    return;
  }

  const initData =
    (req.headers['x-telegram-init-data'] as string) ||
    (req.headers['x-telegram-webapp-initdata'] as string) ||
    (req.query as any)?.initData ||
    (req.body as any)?.initData;
  const v = validateTelegramInitData(typeof initData === 'string' ? initData : '');
  if (!v.ok) return reply.code(401).send({ ok: false, error: 'invalid telegram init data' });

  const chatJson = v.data?.chat ? JSON.parse(v.data.chat) : null;
  const chatId: number | undefined = chatJson?.id ?? (v.data?.user ? JSON.parse(v.data.user)?.id : undefined);
  if (!chatId) return reply.code(400).send({ ok: false, error: 'chat id missing' });

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

  (req as any).project = project;
}
