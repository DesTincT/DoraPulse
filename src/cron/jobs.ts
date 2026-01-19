// src/cron/jobs.ts
import cron from 'node-cron';
import { Telegram } from 'telegraf';
import { ProjectModel } from '../models/Project.js';
import { getWeekly } from '../services/metricsService.js';
import { fmtWeekly, getCurrentIsoWeekTz, getIsoWeekDateRangeTz } from '../utils.js';
import { getPreviousWeekKey } from '../utils/week.js';
import { config } from '../config.js';

// ENV: используем TELEGRAM_BOT_TOKEN
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
const tz = config.timezone || 'Europe/Moscow';

function getTelegram(): Telegram | null {
  if (!BOT_TOKEN) {
    console.warn('[cron] TELEGRAM_BOT_TOKEN не задан — отправка сообщений отключена');
    return null;
  }
  return new Telegram(BOT_TOKEN);
}

// ---------- КРОНЫ ----------

// Пн 09:00 — пройтись по проектам и слать weekly + digest deltas.
cron.schedule(
  '0 9 * * 1',
  async () => {
    const tg = getTelegram();
    if (!tg) return;

    try {
      const projects = await ProjectModel.find({}).select('_id chatId name').lean();
      const thisWeek = getCurrentIsoWeekTz(tz);
      const targetWeek = getPreviousWeekKey(thisWeek);
      const compareWeek = getPreviousWeekKey(targetWeek);
      const r1 = getIsoWeekDateRangeTz(targetWeek, tz)?.label || '';
      const r2 = getIsoWeekDateRangeTz(compareWeek, tz)?.label || '';
      console.info('[cron/digest]', { tz, thisWeek, targetWeek, compareWeek, count: projects.length });
      for (const p of projects) {
        if (!p.chatId) continue;
        try {
          const [cur, prev] = await Promise.all([
            getWeekly(String(p._id), targetWeek),
            getWeekly(String(p._id), compareWeek),
          ]);
          const weeklyText = fmtWeekly({ ...cur, week: targetWeek, weekRange: { label: r1 } });

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
          const dfNow = Number(cur?.df?.count ?? 0);
          const dfPrev = Number(prev?.df?.count ?? 0);
          const cfrNow = typeof cur?.cfr?.value === 'number' ? cur.cfr.value : 0;
          const cfrPrev = typeof prev?.cfr?.value === 'number' ? prev.cfr.value : 0;
          const digest = [`📅 ${targetWeek} (${r1}) vs ${compareWeek} (${r2})`, `🚀 DF: ${dfNow} (${delta(dfNow, dfPrev)})`, `🔁 CFR: ${fmtPct(cfrNow)} (${deltaPct(cfrNow, cfrPrev)})`].join('\n');

          const text = [`📊 DORA Pulse — недельный дайджест`, weeklyText, '', digest, '', `Проект: ${p.name ?? p._id}`].join('\n');

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
          const iso = getCurrentIsoWeekTz(tz);
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
