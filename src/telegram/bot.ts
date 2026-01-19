// src/telegram/bot.ts
import { Telegraf, Markup } from 'telegraf';
import { config } from '../config.js';
import { ProjectModel } from '../models/Project.js';
import { RepoModel } from '../models/Repo.js';
import { randomBytes } from 'crypto';
import { fmtWeekly, getCurrentIsoWeekTz, getIsoWeekDateRangeTz, fmtDuration } from '../utils.js';
import { getLatestCompleteWeekKey, getPreviousWeekKey, getCurrentIsoWeek } from '../utils/week.js';
import { uiText } from './uiText.js';
import { canOpenMiniApp, getMiniAppUrl, miniAppInlineKeyboard, quickActionsKeyboard } from './botUi.js';
import { PulseResponseModel } from '../models/PulseResponse.js';

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

async function fetchWeekly(projectId: string, week: string) {
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
  async function bootstrapCommands(bot: Telegraf) {
    const commandsEn = [
      { command: 'start', description: 'Start and link a project' },
      { command: 'help', description: 'Help' },
      { command: 'metrics', description: 'Show metrics for a week' },
      { command: 'verify', description: 'Why are metrics zero? (self-test)' },
      { command: 'digest', description: 'Send weekly digest' },
      { command: 'pulse', description: 'DevEx survey' },
      { command: 'webapp', description: 'Open Mini-App' },
    ];
    const commandsRu = [
      { command: 'start', description: 'Старт и привязка проекта' },
      { command: 'help', description: 'Помощь' },
      { command: 'metrics', description: 'Метрики за неделю' },
      { command: 'verify', description: 'Почему нули? (самопроверка)' },
      { command: 'digest', description: 'Еженедельный дайджест' },
      { command: 'pulse', description: 'Опрос DevEx' },
      { command: 'webapp', description: 'Открыть мини‑приложение' },
    ];

    const scopes: ({ type: 'all_private_chats' | 'all_group_chats' } | undefined)[] = [
      undefined, // default scope
      { type: 'all_private_chats' },
      { type: 'all_group_chats' }, // optional but useful for “Menu” in groups
    ];

    // 1) Default language
    for (const scope of scopes) {
      const opts = scope ? ({ scope } as any) : undefined;
      await bot.telegram.deleteMyCommands(opts);
      await bot.telegram.setMyCommands(commandsEn, opts);
      console.log('[bot] commands set', { scope: scope?.type ?? 'default', lang: 'default' });
    }

    // 2) Russian locale
    for (const scope of scopes) {
      const opts = { ...(scope ? { scope } : {}), language_code: 'ru' } as any;
      await bot.telegram.deleteMyCommands(opts);
      await bot.telegram.setMyCommands(commandsRu, opts);
      console.log('[bot] commands set', { scope: scope?.type ?? 'default', lang: 'ru' });
    }

    // Ensure the left “Menu” button shows commands instead of being empty.
    await bot.telegram.setChatMenuButton({ menu_button: { type: 'commands' } } as any);
  }

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

  // /help — concise 5-step setup
  bot.command('help', async (ctx) => {
    const steps = [
      '1) /start — создайте/выберите проект',
      '2) Установите GitHub App и выберите репозитории',
      '3) В мини‑приложении укажите прод‑окружения',
      '4) Запустите деплой/воркфлоу, чтобы появились данные',
      '5) Смотрите метрики в /metrics и откройте Mini App',
      '',
      'Если нужны подробности — вынесем расширенную инструкцию позже.',
    ].join('\n');
    await ctx.reply(steps);
  });

  // /link — removed

  // /link_install <installationId> [repoFullName]
  // Admin/private-chat helper to bind a GitHub App installation to the current project.
  bot.command('link_install', async (ctx) => {
    try {
      const p = await ProjectModel.findOne({ chatId: ctx.chat.id });
      if (!p) return ctx.reply(uiText.mustStartFirst);

      const text = String(ctx.message?.text || '').trim();
      const parts = text.split(/\s+/);
      const idRaw = parts[1];
      const repoFullName = parts[2];
      const installationId = Number(idRaw);
      if (!Number.isFinite(installationId) || installationId <= 0) {
        return ctx.reply('Usage: /link_install <installationId> [owner/repo]');
      }

      const update: any = {
        $set: {
          'settings.github.installationId': installationId,
          'settings.github.updatedAt': new Date(),
        },
      };
      if (repoFullName && typeof repoFullName === 'string' && repoFullName.includes('/')) {
        update.$addToSet = { 'settings.github.repos': repoFullName };
      }
      await ProjectModel.updateOne({ _id: p._id }, update);

      await ctx.reply(
        `✅ linked installation ${installationId} to project ${String(p._id)}${repoFullName ? ` (${repoFullName})` : ''}`,
      );
    } catch (e: any) {
      console.error('[bot] /link_install failed', e);
      await ctx.reply('Failed to link installation. Check logs.');
    }
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
    // Persist rating (upsert per user/week)
    try {
      const userId = Number(ctx.from?.id);
      const now = new Date();
      await PulseResponseModel.updateOne(
        { projectId: p._id, week, userId },
        { $set: { rating: score, updatedAt: now }, $setOnInsert: { createdAt: now } },
        { upsert: true },
      );
      // Aggregate results for this week
      const cur = await PulseResponseModel.aggregate([
        { $match: { projectId: p._id, week } },
        {
          $group: {
            _id: '$rating',
            count: { $sum: 1 },
          },
        },
      ]);
      const total = cur.reduce((s: number, r: any) => s + (r.count || 0), 0);
      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const r of cur) {
        // eslint-disable-next-line security/detect-object-injection
        counts[Number(r._id)] = Number(r.count || 0);
      }
      const avg =
        total > 0
          ? (
              (1 * counts[1] + 2 * counts[2] + 3 * counts[3] + 4 * counts[4] + 5 * counts[5]) /
              Math.max(1, total)
            ).toFixed(1)
          : '0.0';
      const weekRange = `${week}${''}`; // label will be included in future if needed
      const results = [
        `📊 Pulse — ${week}`,
        `n=${total}, avg=${avg}`,
        `1: ${counts[1]}`,
        `2: ${counts[2]}`,
        `3: ${counts[3]}`,
        `4: ${counts[4]}`,
        `5: ${counts[5]}`,
      ].join('\n');
      await ctx.answerCbQuery('Saved!');
      await ctx.editMessageText(`${uiText.pulseThanks(week, score)}\n\n${results}`);
    } catch {
      await ctx.answerCbQuery('Saved!');
      await ctx.editMessageText(uiText.pulseThanks(week, score));
    }
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
    if (!parsed) week = getCurrentIsoWeekTz(config.timezone);
    else if (parsed === 'INVALID') return ctx.reply(uiText.invalidWeekFormat);
    else if (parsed === 'PREV') week = getPreviousWeekKey(getCurrentIsoWeekTz(config.timezone));
    else week = parsed;

    const data = await fetchWeekly(String(p._id), week);
    if (process.env.NODE_ENV !== 'production') {
      try {
        const d: any = data || {};
        console.log(
          '[bot:/metrics]',
          {
            week,
            range: d?.weekRange?.label,
            df: d?.df?.count ?? 0,
            cfrDen: d?.cfr?.denominator ?? 0,
            ltSamples: d?.leadTime?.samples ?? 0,
          },
        );
      } catch {}
    }
    await ctx.reply(fmtWeekly(data));
  }

  async function handleDigest(ctx: any) {
    const p = await ProjectModel.findOne({ chatId: ctx.chat.id }).lean();
    if (!p) return ctx.reply(uiText.mustStartFirst);
    const thisWeek = getCurrentIsoWeekTz(config.timezone);
    const prevWeek = getPreviousWeekKey(thisWeek);
    const [cur, prev] = await Promise.all([
      fetchWeekly(String(p._id), thisWeek),
      fetchWeekly(String(p._id), prevWeek),
    ]);
    const r1 = getIsoWeekDateRangeTz(thisWeek)?.label || '';
    const r2 = getIsoWeekDateRangeTz(prevWeek)?.label || '';

    function fmtPct(v?: number) {
      const x = typeof v === 'number' && Number.isFinite(v) ? v : 0;
      return `${(x * 100).toFixed(1)}%`;
    }
    function delta(a?: number, b?: number) {
      const x = (typeof a === 'number' ? a : 0) - (typeof b === 'number' ? b : 0);
      const s = x === 0 ? '±0' : x > 0 ? `+${x}` : `${x}`;
      return s;
    }
    function deltaPct(a?: number, b?: number) {
      const x = (typeof a === 'number' ? a : 0) - (typeof b === 'number' ? b : 0);
      const s = x === 0 ? '±0.0%' : x > 0 ? `+${(x * 100).toFixed(1)}%` : `${(x * 100).toFixed(1)}%`;
      return s;
    }
    function ddur(a?: number, b?: number) {
      const x = (typeof a === 'number' ? a : 0) - (typeof b === 'number' ? b : 0);
      const s = x === 0 ? '±0' : x > 0 ? `+${fmtDuration(x)}` : `-${fmtDuration(Math.abs(x))}`;
      return s;
    }

    const dcur: any = cur || {};
    const dprev: any = prev || {};
    const dfNow = Number(dcur?.df?.count ?? 0);
    const dfPrev = Number(dprev?.df?.count ?? 0);

    const cfrNow = typeof dcur?.cfr?.value === 'number' ? dcur.cfr.value : 0;
    const cfrPrev = typeof dprev?.cfr?.value === 'number' ? dprev.cfr.value : 0;

    const ltN = Number(dcur?.leadTime?.samples ?? 0);
    const ltP50 = Number(dcur?.leadTime?.p50 ?? 0);
    const ltP90 = Number(dcur?.leadTime?.p90 ?? 0);
    const ltP50Prev = Number(dprev?.leadTime?.p50 ?? 0);
    const ltP90Prev = Number(dprev?.leadTime?.p90 ?? 0);

    const prP50 = Number(dcur?.prCycleTime?.p50 ?? 0);
    const prP90 = Number(dcur?.prCycleTime?.p90 ?? 0);
    const prP50Prev = Number(dprev?.prCycleTime?.p50 ?? 0);
    const prP90Prev = Number(dprev?.prCycleTime?.p90 ?? 0);

    const mttrP50 = Number(dcur?.mttr?.p50 ?? 0);
    const mttrP50Prev = Number(dprev?.mttr?.p50 ?? 0);

    const lines = [
      `📅 ${thisWeek} (${r1}) vs ${prevWeek} (${r2})`,
      `🚀 DF: ${dfNow} (${delta(dfNow, dfPrev)})`,
      `🔁 CFR: ${fmtPct(cfrNow)} (${deltaPct(cfrNow, cfrPrev)})`,
      `⏱️ Lead Time p50: ${fmtDuration(ltP50)} (${ddur(ltP50, ltP50Prev)})${ltN >= 10 ? `, p90: ${fmtDuration(ltP90)} (${ddur(ltP90, ltP90Prev)})` : ''}  n=${ltN}`,
      `🔁 PR Cycle p50: ${fmtDuration(prP50)} (${ddur(prP50, prP50Prev)})${prP90 > 0 ? `, p90: ${fmtDuration(prP90)} (${ddur(prP90, prP90Prev)})` : ''}`,
      `🧯 MTTR p50: ${fmtDuration(mttrP50)} (${ddur(mttrP50, mttrP50Prev)})`,
    ].join('\n');

    await ctx.reply(lines);
  }

  async function handlePulse(ctx: any) {
    const week = getLatestCompleteWeekKey(new Date());
    await ctx.reply(
      `📝 Pulse (неделя ${week})\nОцените Developer Experience (1–5):`,
      Markup.inlineKeyboard([[1, 2, 3, 4, 5].map((n) => Markup.button.callback(`${n}`, `pulse:score:${n}:${week}`))]),
    );
  }

  async function handleVerify(ctx: any) {
    const p = await ProjectModel.findOne({ chatId: ctx.chat.id }).lean();
    if (!p) return ctx.reply(uiText.mustStartFirst);

    const week = getCurrentIsoWeekTz(config.timezone);
    let st: any = null;
    try {
      const res = await fetch(
        `${config.publicAppUrl}/projects/${String(p._id)}/selftest?week=${encodeURIComponent(week)}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      st = await res.json();
    } catch {
      st = null;
    }

    if (!st || !st.ok) {
      return ctx.reply('Self-test failed. Please try again later.');
    }

    const reasons: any[] = Array.isArray(st.diagnosticReasons) ? st.diagnosticReasons : [];
    const top = reasons
      .slice(0, 2)
      .map((r) => `- ${r.code}: ${r.message}`)
      .join('\n');
    const selftestUrl = `${config.publicAppUrl}/projects/${String(p._id)}/selftest?week=${encodeURIComponent(week)}`;
    const summary = [
      `🧪 Self-test (week ${st.weekKey})`,
      `- webhooks15m: ${st.ingestion?.webhooks15m ?? 0}, 24h: ${st.ingestion?.webhooks24h ?? 0}`,
      `- deploys(prod success): ${st.dataPresence?.deploysInWeekProd ?? 0} (matched total ${st.dataPresence?.deploysInWeekTotal ?? 0})`,
      `- prs merged: ${st.dataPresence?.prsMergedInWeek ?? 0}`,
      '',
      top ? `Top reasons:\n${top}` : 'No issues detected.',
      '',
      `Selftest: ${selftestUrl}`,
      `ProjectId: ${String(p._id)} (open Mini App → Self-test)`,
    ].join('\n');

    const webAppUrl = getMiniAppUrl();
    await ctx.reply(summary);
    if (canOpenMiniApp(webAppUrl)) {
      await ctx.reply(uiText.openMiniAppLabel, miniAppInlineKeyboard(webAppUrl));
    }
  }

  // Commands
  bot.command('metrics', handleMetrics);
  bot.command('verify', handleVerify);
  bot.command('digest', handleDigest);
  bot.command('pulse', handlePulse);

  // Buttons (hears)
  bot.hears(/📊\s*Metrics/i, handleMetrics);
  bot.hears(/🗓\s*Digest/i, handleDigest);
  bot.hears(/📝\s*Pulse/i, handlePulse);

  bot.catch((_, ctx) => {
    console.error('Telegraf error on update', ctx.update);
  });

  async function startBot() {
    await bootstrapCommands(bot);
    await bot.launch();
    console.log('[bot] launched (polling + UI)');
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }

  void startBot().catch((err) => {
    console.error('[bot] fatal startup error', err);
    process.exit(1);
  });
}
