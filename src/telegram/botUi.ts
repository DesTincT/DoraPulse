import { Markup } from 'telegraf';
import { config } from '../config.js';
import { uiText } from './uiText.js';

const isHttps = (u?: string) => !!u && /^https:\/\//i.test(u);

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

export function getMiniAppUrl(): string {
  const base = process.env.MINIAPP_URL || `${config.publicAppUrl}/webapp/`;
  // Always use /webapp/ (trailing slash) to avoid redirect chains in Telegram WebView.
  return ensureTrailingSlash(base);
}

export function quickActionsKeyboard() {
  const row1 = [Markup.button.text(uiText.menu.metrics), Markup.button.text(uiText.menu.digest)];
  const row2 = [Markup.button.text(uiText.menu.pulse)];
  return Markup.keyboard([row1, row2]).resize();
}

export function miniAppInlineKeyboard(url: string) {
  return Markup.inlineKeyboard([Markup.button.webApp(uiText.menu.openMiniApp, url)]);
}

export function canOpenMiniApp(url: string): boolean {
  return isHttps(url);
}
