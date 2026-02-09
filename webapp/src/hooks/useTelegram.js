import { useEffect } from 'react';

export function useTelegram() {
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData || '';
  const detected = !!tg;
  const initDataLen = initData ? initData.length : 0;

  useEffect(() => {
    const applyTheme = (themeParams) => {
      if (!themeParams || typeof themeParams !== 'object') return;
      const root = document.documentElement;

      const pick = (key) => {
        const v = themeParams[key];
        return typeof v === 'string' && v.trim() ? v.trim() : null;
      };

      const set = (name, value) => {
        if (!value) return;
        root.style.setProperty(name, value);
      };

      const hexToRgb = (hex) => {
        const raw = String(hex || '').trim();
        if (!raw.startsWith('#')) return null;
        const h = raw.slice(1);
        const isShort = h.length === 3;
        const isLong = h.length === 6;
        if (!isShort && !isLong) return null;
        const full = isShort
          ? h
              .split('')
              .map((c) => c + c)
              .join('')
          : h;
        const n = Number.parseInt(full, 16);
        if (!Number.isFinite(n)) return null;
        // eslint-disable-next-line no-bitwise
        const r = (n >> 16) & 255;
        // eslint-disable-next-line no-bitwise
        const g = (n >> 8) & 255;
        // eslint-disable-next-line no-bitwise
        const b = n & 255;
        return { r, g, b };
      };

      const rgba = (rgb, a) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;

      const bg = pick('bg_color');
      const text = pick('text_color');
      const hint = pick('hint_color');
      const link = pick('link_color');
      const button = pick('button_color');
      const buttonText = pick('button_text_color');
      const secondaryBg = pick('secondary_bg_color');
      const headerBg = pick('header_bg_color');

      set('--tg-bg', bg);
      set('--tg-text', text);
      set('--tg-hint', hint);
      set('--tg-link', link);
      set('--tg-button', button);
      set('--tg-button-text', buttonText);
      set('--tg-secondary-bg', secondaryBg);
      set('--tg-header-bg', headerBg);

      const textRgb = hexToRgb(text || '#111827');
      if (textRgb) {
        // Telegram-like subtle divider derived from current text color
        set('--tg-divider', rgba(textRgb, 0.12));
      }
    };

    const applySafeArea = () => {
      const root = document.documentElement;
      const inset = tg?.safeAreaInset || tg?.contentSafeAreaInset;
      const top = inset?.top ?? 0;
      const bottom = inset?.bottom ?? 0;
      const left = inset?.left ?? 0;
      const right = inset?.right ?? 0;
      root.style.setProperty('--tg-safe-top', `${top}px`);
      root.style.setProperty('--tg-safe-bottom', `${bottom}px`);
      root.style.setProperty('--tg-safe-left', `${left}px`);
      root.style.setProperty('--tg-safe-right', `${right}px`);
    };

    try {
      if (tg && typeof tg.ready === 'function') tg.ready();
      if (tg && typeof tg.expand === 'function') tg.expand();
    } catch {}

    try {
      if (tg?.themeParams) applyTheme(tg.themeParams);
    } catch {}
    try {
      applySafeArea();
    } catch {}

    const onThemeChanged = () => {
      try {
        applyTheme(tg?.themeParams);
      } catch {}
    };
    const onViewportChanged = () => {
      try {
        applySafeArea();
      } catch {}
    };

    if (tg && typeof tg.onEvent === 'function') tg.onEvent('themeChanged', onThemeChanged);
    if (tg && typeof tg.onEvent === 'function') tg.onEvent('viewportChanged', onViewportChanged);
    return () => {
      if (tg && typeof tg.offEvent === 'function') tg.offEvent('themeChanged', onThemeChanged);
      if (tg && typeof tg.offEvent === 'function') tg.offEvent('viewportChanged', onViewportChanged);
    };
  }, [tg]);

  return { tg, initData, detected, initDataLen };
}
