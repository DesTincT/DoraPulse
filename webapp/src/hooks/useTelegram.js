export function useTelegram() {
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData || '';
  try {
    if (tg && typeof tg.ready === 'function') tg.ready();
    if (tg && typeof tg.expand === 'function') tg.expand();
  } catch {}
  return { tg, initData };
}
