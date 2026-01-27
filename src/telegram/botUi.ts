import { Markup } from 'telegraf';
import { config } from '../config.js';
import { uiText } from './uiText.js';

const isHttps = (u?: string) => !!u && /^https:\/\//i.test(u);

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

export function getMiniAppUrl(): string {
  // Highest priority: explicit override
  const raw = (process.env.MINIAPP_URL || '').trim();
  if (raw) return ensureTrailingSlash(raw);

  // Default: public app root (Vite build lives there)
  // IMPORTANT: do NOT append /webapp/ anymore.
  return ensureTrailingSlash(config.publicAppUrl);
}

export function quickActionsKeyboard() {
  // TEMP: hide reply-keyboard quick actions; rely on Telegram left “Menu” commands instead.
  return Markup.removeKeyboard();
}

export function miniAppInlineKeyboard(url: string) {
  return Markup.inlineKeyboard([Markup.button.webApp(uiText.menu.openMiniApp, url)]);
}

export function canOpenMiniApp(url: string): boolean {
  return isHttps(url);
}
