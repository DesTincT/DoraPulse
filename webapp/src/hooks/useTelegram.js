export function useTelegram() {
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData || '';
  const detected = !!tg;
  const initDataLen = initData ? initData.length : 0;
  try {
    if (tg && typeof tg.ready === 'function') tg.ready();
    if (tg && typeof tg.expand === 'function') tg.expand();
  } catch {}
  return { tg, initData, detected, initDataLen };
}
