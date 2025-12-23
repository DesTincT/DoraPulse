// src/cron/jobs.ts
import cron from 'node-cron';
import { Telegram } from 'telegraf';
import { ProjectModel } from '../models/Project.js';
import { getWeekly } from '../services/metricsService.js';
import { fmtWeekly } from '../utils.js';

// ENV: используем TELEGRAM_BOT_TOKEN
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
const tz = 'Europe/Moscow';

function getTelegram(): Telegram | null {
  if (!BOT_TOKEN) {
    console.warn('[cron] TELEGRAM_BOT_TOKEN не задан — отправка сообщений отключена');
    return null;
  }
  return new Telegram(BOT_TOKEN);
}

// ---------- КРОНЫ ----------

// Пн 09:00 — пройтись по проектам и слать weekly digest.
cron.schedule(
  '0 9 * * 1',
  async () => {
    const tg = getTelegram();
    if (!tg) return;

    try {
      const projects = await ProjectModel.find({}).select('_id chatId name').lean();
      for (const p of projects) {
        if (!p.chatId) continue;
        try {
          // last full ISO week вам уже считает backend по умолчанию,
          // но для явности можно передать, например, из переменной или вычислить отдельно.
          const weekly = await getWeekly(String(p._id), undefined as any);
          const text = [
            `📊 *DORA Pulse — недельный дайджест*`,
            fmtWeekly(weekly),
            '',
            `Проект: ${p.name ?? p._id}`,
          ].join('\n');

          await tg.sendMessage(p.chatId as any, text, { parse_mode: 'Markdown' });
        } catch (e) {
          console.warn('[cron/digest] send failed for project', p._id, e);
        }
      }
    } catch (e) {
      console.warn('[cron/digest] list projects failed', e);
    }
  },
  { timezone: tz },
);

// Ср 11:00 — Pulse-опрос (1–5) с inline-кнопками.
cron.schedule(
  '0 11 * * 3',
  async () => {
    const tg = getTelegram();
    if (!tg) return;

    try {
      const projects = await ProjectModel.find({}).select('_id chatId').lean();
      for (const p of projects) {
        if (!p.chatId) continue;
        try {
          const week = new Date(); // можно подставлять конкретную ISO-неделю, если нужно
          const iso = week.toISOString().slice(0, 10); // условный маркер (для MVP)
          const text = `📝 Pulse (неделя ${iso})\nОцените Developer Experience (1–5):`;

          // reply_markup как «сырой» JSON (без Markup — мы в кроне, без Telegraf контекста)
          await tg.sendMessage(p.chatId as any, text, {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '1', callback_data: `pulse:score:1:${iso}` },
                  { text: '2', callback_data: `pulse:score:2:${iso}` },
                  { text: '3', callback_data: `pulse:score:3:${iso}` },
                  { text: '4', callback_data: `pulse:score:4:${iso}` },
                  { text: '5', callback_data: `pulse:score:5:${iso}` },
                ],
              ],
            },
          });
        } catch (e) {
          console.warn('[cron/pulse] send failed for project', p._id, e);
        }
      }
    } catch (e) {
      console.warn('[cron/pulse] list projects failed', e);
    }
  },
  { timezone: tz },
);

// (Опционально) Ежедневно 10:00 — «пинг» метрик, без аномалий (MVP)
// Если позже добавите getAnomalies, можно дописать сюда алерты.
cron.schedule(
  '0 10 * * *',
  async () => {
    try {
      const projects = await ProjectModel.find({}).select('_id').lean();
      for (const p of projects) {
        // Просто «подогреем» кэш/агрегации, дернув расчёт
        try {
          await getWeekly(String(p._id), undefined as any);
        } catch {}
      }
    } catch (e) {
      console.warn('[cron/warmup] failed', e);
    }
  },
  { timezone: tz },
);
