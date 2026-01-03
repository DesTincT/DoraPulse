// src/telegram/bot.ts
import { Telegraf, Markup } from 'telegraf';
import { config } from '../config.js';
import { ProjectModel } from '../models/Project.js';
import { RepoModel } from '../models/Repo.js';
import { randomBytes } from 'crypto';
import { fmtWeekly, currentIsoWeek } from '../utils.js';
import { uiText } from './uiText.js';
import { canOpenMiniApp, getMiniAppUrl, miniAppInlineKeyboard, quickActionsKeyboard } from './botUi.js';

const WEEK_DEFAULT = '2025-W49'; // можно динамически, но для демо — фикс

function parseWeekArg(text?: string) {
  // text: "/metrics 2025-W51" | "/metrics" | "/metrics@MyBot 2025-W51"
  if (!text) return null;

  const parts = text.trim().split(/\s+/);
  // parts[0] = "/metrics" или "/metrics@botname"
  const arg = parts[1]?.trim();
  if (!arg) return null;

  // нормализуем
  const upper = arg.toUpperCase();

  if (upper === 'PREV' || upper === 'LAST') return 'PREV';

  // ISO week: YYYY-Www (w = 01..53)
  if (/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(upper)) return upper;

  return 'INVALID';
}

function mainMenu() {
  // IMPORTANT: Telegram Desktop is unreliable with reply-keyboard WebApp buttons (often initDataLen=0).
  // Keep quick actions on the reply keyboard, but send the Mini App as a separate INLINE WebApp button.
  return quickActionsKeyboard();
}

async function fetchWeekly(projectId: string, week = WEEK_DEFAULT) {
  try {
    const res = await fetch(
      `${config.publicAppUrl}/projects/${projectId}/metrics/weekly?week=${encodeURIComponent(week)}`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return null;
  }
}

export function initBotPolling() {
  if (!config.botToken) {
    console.warn('[bot] TELEGRAM_BOT_TOKEN not set — bot disabled');
    return;
  }
  const bot = new Telegraf(config.botToken);

  // Commands menu
  bot.telegram
    .setMyCommands([
      { command: 'start', description: 'Start and link a project' },
      { command: 'help', description: 'Help' },
      { command: 'link', description: 'GitHub webhook instructions' },
      { command: 'metrics', description: 'Show metrics for a week' },
      { command: 'digest', description: 'Send weekly digest' },
      { command: 'pulse', description: 'DevEx survey' },
      { command: 'webapp', description: 'Open Mini‑App' },
    ])
    .catch(() => {});

  // /start — find/create project and show menu
  bot.start(async (ctx) => {
    let project = await ProjectModel.findOne({ chatId: ctx.chat.id });
    if (!project) {
      const accessKey = randomBytes(9).toString('base64url');
      const chatAny = ctx.chat as any;
      const uname: string | undefined =
        chatAny && typeof chatAny === 'object' && 'username' in chatAny ? chatAny.username : undefined;
      project = await ProjectModel.create({
        name: uname ?? `project-${ctx.chat.id}`,
        chatId: ctx.chat.id,
        accessKey,
        settings: { prodRule: { branch: 'main', workflowNameRegex: 'deploy.*prod' }, ltBaseline: 'pr_open' },
      });
      await RepoModel.findOneAndUpdate(
        { projectId: project._id, owner: 'acme', name: 'checkout' },
        { $setOnInsert: { defaultBranch: 'main' } },
        { new: true, upsert: true },
      );
    }

    const startLines = uiText.startIntroLines.join('\n');
    await ctx.reply(startLines, mainMenu());

    const webAppUrl = getMiniAppUrl();
    if (canOpenMiniApp(webAppUrl)) {
      await ctx.reply(uiText.openMiniAppLabel, miniAppInlineKeyboard(webAppUrl));
    } else {
      await ctx.reply(`${uiText.webappNeedsHttps}\n${webAppUrl}`);
    }
  });

  // /help
  bot.command('help', async (ctx) => {
    // Telegram MarkdownV2: keep formatting predictable, especially for code blocks.
    const escapeMdV2 = (s: string) => s.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');

    const commands = ['*Available commands:*', ...uiText.helpLines.slice(1).map(escapeMdV2)].join('\n');

    const howToHeader = '*Enable deployment metrics DF/CFR:*';
    const howToBody = uiText.helpDoraDeployHowToLines.map((line) => {
      // Preserve inline code marked with backticks by escaping only outside of them.
      // Simple approach: if a line contains backticks, we assume it’s intentional and keep it as-is.
      return line.includes('`') ? line : escapeMdV2(line);
    });
    const howTo = [howToHeader, ...howToBody, '', '```yaml', uiText.helpDoraDeployWorkflowYaml.trimEnd(), '```'].join(
      '\n',
    );

    await ctx.reply(commands, { parse_mode: 'MarkdownV2', link_preview_options: { is_disabled: true } });
    await ctx.reply(howTo, { parse_mode: 'MarkdownV2', link_preview_options: { is_disabled: true } });
  });

  // /link — GitHub Webhook instruction
  bot.command('link', async (ctx) => {
    const p = await ProjectModel.findOne({ chatId: ctx.chat.id }).lean();
    if (!p) return ctx.reply(uiText.mustStartFirst);
    const lines = uiText.startWebhookInfo(
      config.publicAppUrl,
      p.accessKey,
      config.webhookSecret || 'devsecret (local)',
    );
    await ctx.reply(['🔗 GitHub Webhook:', ...lines.slice(1)].join('\n'));
  });

  // Pulse callback handler
  bot.on('callback_query', async (ctx) => {
    const cq: any = ctx.callbackQuery as any;
    const data: string = typeof cq?.data === 'string' ? cq.data : '';
    if (!data.startsWith('pulse:score:')) return ctx.answerCbQuery();
    const [, , scoreStr, week] = data.split(':');
    const score = Number(scoreStr);
    const p = await ProjectModel.findOne({ chatId: ctx?.chat?.id }).lean();
    if (!p) {
      await ctx.answerCbQuery(uiText.mustStartFirst);
      return;
    }
    // отправим на API (если эндпоинт есть) — иначе молча игнорим ошибку
    try {
      await fetch(`${config.publicAppUrl}/pulse/answer`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: String(p._id),
          userTgId: ctx.from?.id,
          week,
          answers: { satisfaction: score, ciUnder10min: null, blocker: null },
        }),
      });
    } catch {}
    await ctx.answerCbQuery('Thanks!');
    await ctx.editMessageText(uiText.pulseThanks(week, score));
  });

  // /webapp — open Mini‑App button (if URL exists)
  bot.command('webapp', async (ctx) => {
    const webAppUrl = getMiniAppUrl();
    if (canOpenMiniApp(webAppUrl)) {
      await ctx.reply(uiText.openMiniAppLabel, miniAppInlineKeyboard(webAppUrl));
    } else {
      await ctx.reply(`${uiText.webappNeedsHttps}\n${webAppUrl}`);
    }
  });

  async function handleMetrics(ctx: any) {
    const p = await ProjectModel.findOne({ chatId: ctx.chat.id }).lean();
    if (!p) return ctx.reply(uiText.mustStartFirst);

    const parsed = parseWeekArg(ctx.message?.text);

    let week: string;
    if (!parsed) week = currentIsoWeek() || WEEK_DEFAULT;
    else if (parsed === 'INVALID') return ctx.reply(uiText.invalidWeekFormat);
    else week = parsed;

    const data = await fetchWeekly(String(p._id), week);
    if (process.env.NODE_ENV !== 'production') {
      try {
        const d: any = data || {};
        console.log('[bot:/metrics]', {
          week,
          df: d?.df?.count ?? 0,
          cfrDen: d?.cfr?.denominator ?? 0,
          ltSamples: d?.leadTime?.samples ?? 0,
        });
      } catch {}
    }
    await ctx.reply(fmtWeekly(data));
  }

  async function handleDigest(ctx: any) {
    const p = await ProjectModel.findOne({ chatId: ctx.chat.id }).lean();
    if (!p) return ctx.reply(uiText.mustStartFirst);
    const week = currentIsoWeek() || WEEK_DEFAULT;
    const data = await fetchWeekly(String(p._id), week);
    const text = [
      uiText.weeklyDigestTitle,
      fmtWeekly(data),
      '',
      'ℹ️ This is a demo digest. The full version will include trends and anomalies.',
    ].join('\n');
    await ctx.replyWithMarkdown(text);
  }

  async function handlePulse(ctx: any) {
    const week = currentIsoWeek() || WEEK_DEFAULT; // можно вычислять current-1w
    await ctx.reply(
      `📝 Pulse (неделя ${week})\nОцените Developer Experience (1–5):`,
      Markup.inlineKeyboard([[1, 2, 3, 4, 5].map((n) => Markup.button.callback(`${n}`, `pulse:score:${n}:${week}`))]),
    );
  }

  // Commands
  bot.command('metrics', handleMetrics);
  bot.command('digest', handleDigest);
  bot.command('pulse', handlePulse);

  // Buttons (hears)
  bot.hears(/📊\s*Metrics/i, handleMetrics);
  bot.hears(/🗓\s*Digest/i, handleDigest);
  bot.hears(/📝\s*Pulse/i, handlePulse);

  bot.catch((_, ctx) => {
    console.error('Telegraf error on update', ctx.update);
  });

  // Запуск
  bot.launch().then(() => console.log('[bot] launched (polling + UI)'));
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
