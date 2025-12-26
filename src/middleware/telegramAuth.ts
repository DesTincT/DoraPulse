import { FastifyRequest, FastifyReply } from 'fastify';
import { createHmac, createHash } from 'crypto';
import { ProjectModel } from '../models/Project.js';
import { config } from '../config.js';

function parseInitData(raw?: string): Record<string, string> | null {
  if (!raw || typeof raw !== 'string') return null;
  const out: Record<string, string> = {};
  for (const part of raw.split('&')) {
    const [k, v] = part.split('=');
    if (!k) continue;
    out[k] = decodeURIComponent(v || '');
  }
  return out;
}

function validateTelegramInitData(raw?: string): { ok: boolean; data?: any } {
  try {
    const parsed = parseInitData(raw);
    if (!parsed) return { ok: false };
    const hash = parsed['hash'] || '';
    const data = { ...parsed };
    delete (data as any)['hash'];
    const pairs = Object.keys(data)
      .sort()
      .map((k) => `${k}=${data[k]}`);
    const dataCheckString = pairs.join('\n');
    const secret = createHash('sha256').update(config.botToken).digest();
    const hmac = createHmac('sha256', secret).update(dataCheckString).digest('hex');
    if (hmac !== hash) return { ok: false };
    return { ok: true, data: parsed };
  } catch {
    return { ok: false };
  }
}

export async function telegramAuth(req: FastifyRequest, reply: FastifyReply) {
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

  let project = await ProjectModel.findOne({ chatId }).lean();
  if (!project) {
    const created = await new ProjectModel({
      name: `project-${chatId}`,
      chatId,
      accessKey: Math.random().toString(36).slice(2, 11),
      settings: { prodRule: { branch: 'main', workflowNameRegex: 'deploy.*prod' }, ltBaseline: 'pr_open' },
    } as any).save();
    project = await ProjectModel.findById((created as any)._id).lean();
  }

  (req as any).project = project;
}
