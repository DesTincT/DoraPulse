// src/telegram/bot.ts
import { Telegraf, Markup } from 'telegraf';
import { config } from '../config.js';
import { ProjectModel } from '../models/Project.js';
import { RepoModel } from '../models/Repo.js';
import { randomBytes } from 'crypto';
import { fmtWeekly, currentIsoWeek } from '../utils.js';

const WEEK_DEFAULT = '2025-W49'; // можно динамически, но для демо — фикс
const isHttps = (u?: string) => !!u && /^https:\/\//i.test(u);

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

function mainMenu(webAppUrl?: string) {
  const row1 = [Markup.button.text('📊 Метрики'), Markup.button.text('🗓 Дайджест')];
  const row2 = [Markup.button.text('📝 Pulse')];
  if (isHttps(webAppUrl)) {
    return Markup.keyboard([row1, row2, [Markup.button.webApp('🌐 Открыть Mini-App', webAppUrl!)]]).resize();
  }
  return Markup.keyboard([row1, row2]).resize();
}

async function fetchWeekly(projectId: string, week = WEEK_DEFAULT) {
  try {
    const res = await fetch(
      `${config.publicAppUrl}/projects/${projectId}/metrics/weekly?week=${encodeURIComponent(week)}`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return null;
  }
}

export function initBotPolling() {
  if (!config.botToken) {
    console.warn('[bot] TELEGRAM_BOT_TOKEN not set — bot disabled');
    return;
  }
  const bot = new Telegraf(config.botToken);

  // Команды в меню Telegram
  bot.telegram
    .setMyCommands([
      { command: 'start', description: 'Запуск и привязка проекта' },
      { command: 'help', description: 'Справка' },
      { command: 'link', description: 'Инструкция по GitHub Webhook' },
      { command: 'metrics', description: 'Показать метрики за неделю' },
      { command: 'digest', description: 'Отправить еженедельный дайджест' },
      { command: 'pulse', description: 'Pulse-опрос (DevEx)' },
      { command: 'webapp', description: 'Открыть Mini-App' },
    ])
    .catch(() => {});

  // /start — регистрируем/находим проект и показываем меню
  bot.start(async (ctx) => {
    // ищем проект по chatId, если нет — создаём простейший
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
      // базовый репозиторий для демо
      await RepoModel.findOneAndUpdate(
        { projectId: project._id, owner: 'acme', name: 'checkout' },
        { $setOnInsert: { defaultBranch: 'main' } },
        { new: true, upsert: true },
      );
    }

    const webAppUrl = process.env.MINIAPP_URL || `${config.publicAppUrl}/webapp`; // поменяй при деплое
    await ctx.reply(
      [
        '👋 Привет! Я DORA Pulse бот.',
        'Готов принимать события из GitHub и показывать сводки.',
        '',
        `projectId: ${project._id}`,
        `PAK (accessKey): ${project.accessKey}`,
      ].join('\n'),
      mainMenu(webAppUrl),
    );
  });

  // /help
  bot.command('help', async (ctx) => {
    await ctx.reply(
      [
        'Доступные команды:',
        '/link — инструкция по вебхуку GitHub',
        '/metrics — метрики за неделю',
        '/digest — отправить недельный дайджест',
        '/pulse — DevEx-опрос',
        '/webapp — открыть Mini-App',
      ].join('\n'),
    );
  });

  // /link — как настроить GitHub Webhook
  bot.command('link', async (ctx) => {
    const p = await ProjectModel.findOne({ chatId: ctx.chat.id }).lean();
    if (!p) return ctx.reply('Сначала /start, чтобы создать проект.');
    await ctx.reply(
      [
        '🔗 Подключение GitHub Webhook:',
        `Payload URL: ${config.publicAppUrl}/webhooks/github?projectKey=${p.accessKey}`,
        `Secret: ${config.webhookSecret || 'devsecret (локально)'}`,
        'Events: Pull requests, Pushes, Workflow runs',
        'Content type: application/json',
      ].join('\n'),
    );
  });

  // обработчик ответа Pulse
  bot.on('callback_query', async (ctx) => {
    const cq: any = ctx.callbackQuery as any;
    const data: string = typeof cq?.data === 'string' ? cq.data : '';
    if (!data.startsWith('pulse:score:')) return ctx.answerCbQuery();
    const [, , scoreStr, week] = data.split(':');
    const score = Number(scoreStr);
    const p = await ProjectModel.findOne({ chatId: ctx?.chat?.id }).lean();
    if (!p) {
      await ctx.answerCbQuery('Сначала /start');
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
    await ctx.answerCbQuery(`Спасибо! Ваша оценка: ${score}`);
    await ctx.editMessageText(`📝 Pulse (неделя ${week})\nОтвет получен: ${score}/5 ✅`);
  });

  // /webapp — кнопка открыть Mini-App (если есть URL)
  bot.command('webapp', async (ctx) => {
    const webAppUrl = process.env.MINIAPP_URL || `${config.publicAppUrl}/webapp`;
    if (isHttps(webAppUrl)) {
      await ctx.reply(
        'Откройте Mini-App:',
        Markup.keyboard([[Markup.button.webApp('🌐 Открыть Mini-App', webAppUrl)]]).resize(),
      );
    } else {
      await ctx.reply(
        'Для WebApp-кнопки нужен HTTPS.\n' +
          `Временно открой ссылку: ${webAppUrl}\n\n` +
          'Или подними ngrok: ngrok http 8080 и выставь MINIAPP_URL=https://<ngrok>/webapp',
      );
    }
  });

  async function handleMetrics(ctx: any) {
    const p = await ProjectModel.findOne({ chatId: ctx.chat.id }).lean();
    if (!p) return ctx.reply('Сначала /start.');

    const parsed = parseWeekArg(ctx.message?.text);

    let week: string;
    if (!parsed) week = currentIsoWeek() || WEEK_DEFAULT;
    else if (parsed === 'INVALID') return ctx.reply('Формат: /metrics или /metrics 2025-W51');
    else week = parsed;

    const data = await fetchWeekly(String(p._id), week);
    await ctx.reply(fmtWeekly(data));
  }

  async function handleDigest(ctx: any) {
    const p = await ProjectModel.findOne({ chatId: ctx.chat.id }).lean();
    if (!p) return ctx.reply('Сначала /start.');
    const week = currentIsoWeek() || WEEK_DEFAULT;
    const data = await fetchWeekly(String(p._id), week);
    const text = [
      '📊 *DORA Pulse — недельный дайджест*',
      fmtWeekly(data),
      '',
      'ℹ️ Это демо-дайджест. Полная сводка будет включать динамику и аномалии.',
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

  // Команды
  bot.command('metrics', handleMetrics);
  bot.command('digest', handleDigest);
  bot.command('pulse', handlePulse);

  // Кнопки (hears)
  bot.hears(/📊\s*Метрики/i, handleMetrics);
  bot.hears(/🗓\s*Дайджест/i, handleDigest);
  bot.hears(/📝\s*Pulse/i, handlePulse);

  bot.catch((err, ctx) => {
    console.error('Telegraf error', err, 'on update', ctx.update);
  });

  // Запуск
  bot.launch().then(() => console.log('[bot] launched (polling + UI)'));
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
