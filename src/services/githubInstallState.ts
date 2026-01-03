import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../config.js';

export interface GithubInstallStatePayload {
  projectId: string;
  chatId: number;
  iat: number; // unix seconds
}

function base64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64urlDecodeToBuffer(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64');
}

function sign(input: string): string {
  const mac = createHmac('sha256', config.webhookSecret).update(input).digest();
  return base64urlEncode(mac);
}

/**
 * Signed state token for GitHub App installation:
 *   state = base64url(JSON(payload)) + "." + base64url(HMAC_SHA256(secret, base64url(JSON(payload))))
 */
export function createGithubInstallState(payload: Omit<GithubInstallStatePayload, 'iat'>): string {
  const full: GithubInstallStatePayload = { ...payload, iat: Math.floor(Date.now() / 1000) };
  const body = base64urlEncode(Buffer.from(JSON.stringify(full), 'utf8'));
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function verifyGithubInstallState(
  token: string,
  opts?: { maxAgeSec?: number },
): { ok: true; payload: GithubInstallStatePayload } | { ok: false; reason: string } {
  const raw = String(token || '');
  const [body, sig] = raw.split('.', 2);
  if (!body || !sig) return { ok: false, reason: 'bad_format' };

  const expected = sign(body);
  const left = Buffer.from(expected);
  const right = Buffer.from(sig);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return { ok: false, reason: 'bad_sig' };

  let payload: GithubInstallStatePayload | null = null;
  try {
    payload = JSON.parse(base64urlDecodeToBuffer(body).toString('utf8'));
  } catch {
    return { ok: false, reason: 'bad_json' };
  }

  if (!payload || typeof payload !== 'object') return { ok: false, reason: 'bad_payload' };
  if (!payload.projectId || typeof payload.projectId !== 'string') return { ok: false, reason: 'missing_projectId' };
  if (!Number.isFinite(payload.chatId) || payload.chatId <= 0) return { ok: false, reason: 'missing_chatId' };
  if (!Number.isFinite(payload.iat) || payload.iat <= 0) return { ok: false, reason: 'missing_iat' };

  const maxAge = opts?.maxAgeSec ?? 24 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);
  if (now - payload.iat > maxAge) return { ok: false, reason: 'expired' };

  return { ok: true, payload };
}
