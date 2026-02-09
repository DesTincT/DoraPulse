import { useCallback, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { useTelegram } from './hooks/useTelegram.js';
import { useBootstrap } from './hooks/useBootstrap.js';
import { useEnvs } from './hooks/useEnvs.js';
import { useSelfTest } from './hooks/useSelfTest.js';
import { Header } from './components/Header.jsx';
import { ListSection } from './components/ListSection.jsx';
import { InstallRow } from './components/InstallRow.jsx';
import { VerifyRow } from './components/VerifyRow.jsx';
import { EnvRow } from './components/EnvRow.jsx';
import { InlineMessage } from './components/InlineMessage.jsx';

try {
  if (typeof globalThis?.performance?.mark === 'function') {
    globalThis.performance.mark('app_start');
  }
} catch {}

function App() {
  const { tg, initData } = useTelegram();
  const bootstrap = useBootstrap(initData);
  const envs = useEnvs(initData, { autoLoad: false, initial: bootstrap.data });
  const self = useSelfTest(initData);
  const { run: runSelf, running: selfRunning, result: selfResult, error: selfError } = self;

  const authed = !!bootstrap.data?.ok;
  const bootstrapLoading = bootstrap.loading && !bootstrap.fromCache;
  const lastErrorRef = useRef(null);
  const lastSelfResultRef = useRef(null);
  const interactiveMarkedRef = useRef(false);

  const openInTelegram = bootstrap.initMissing || bootstrap.error === 'open_in_telegram';

  const haptics = tg?.HapticFeedback;
  const hapticSuccess = useCallback(() => {
    try {
      if (haptics?.notificationOccurred) haptics.notificationOccurred('success');
    } catch {}
  }, [haptics]);
  const hapticError = useCallback(() => {
    try {
      if (haptics?.notificationOccurred) haptics.notificationOccurred('error');
    } catch {}
  }, [haptics]);

  useEffect(() => {
    if (bootstrap.error && bootstrap.error !== lastErrorRef.current) {
      lastErrorRef.current = bootstrap.error;
      hapticError();
    }
  }, [bootstrap.error, hapticError]);

  useEffect(() => {
    if (tg?.BackButton && typeof tg.BackButton.hide === 'function') {
      try {
        tg.BackButton.hide();
      } catch {}
    }
  }, [tg]);

  useEffect(() => {
    if (!tg?.MainButton) return;
    const main = tg.MainButton;
    const canInstall = !!bootstrap.data?.githubInstallUrl;
    const installed = !!bootstrap.data?.installed;
    const visible = !bootstrapLoading && !openInTelegram && (canInstall || installed);

    const handleClick = () => {
      if (!installed && canInstall) {
        const url = bootstrap.data?.githubInstallUrl;
        if (!url) return;
        try {
          if (tg?.openLink) tg.openLink(url);
          else window.open(url, '_blank');
        } catch {
          window.open(url, '_blank');
        }
        return;
      }
      if (installed) {
        void runSelf();
      }
    };

    try {
      if (!visible) {
        if (typeof main.hide === 'function') main.hide();
      } else {
        if (!installed && canInstall) {
          if (typeof main.setText === 'function') main.setText('Install GitHub App');
          if (typeof main.enable === 'function') main.enable();
        } else {
          if (typeof main.setText === 'function') main.setText(selfRunning ? 'Verifying…' : 'Verify');
          if (selfRunning && typeof main.disable === 'function') main.disable();
          if (!selfRunning && typeof main.enable === 'function') main.enable();
        }
        if (typeof main.show === 'function') main.show();
      }
      if (typeof main.onClick === 'function') main.onClick(handleClick);
    } catch {}

    return () => {
      try {
        if (typeof main.offClick === 'function') main.offClick(handleClick);
      } catch {}
    };
  }, [bootstrap.data, bootstrapLoading, openInTelegram, runSelf, selfRunning, tg]);

  useEffect(() => {
    if (selfError) hapticError();
  }, [hapticError, selfError]);

  useEffect(() => {
    if (!selfResult) return;
    if (selfResult === lastSelfResultRef.current) return;
    lastSelfResultRef.current = selfResult;
    hapticSuccess();
  }, [hapticSuccess, selfResult]);

  useEffect(() => {
    try {
      if (typeof globalThis?.performance?.mark === 'function') {
        globalThis.performance.mark('first_shell');
        if (typeof globalThis?.performance?.measure === 'function') {
          globalThis.performance.measure('tt_shell', 'app_start', 'first_shell');
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (interactiveMarkedRef.current) return;
    if (!bootstrap.data && !openInTelegram) return;
    interactiveMarkedRef.current = true;
    try {
      if (typeof globalThis?.performance?.mark === 'function') {
        globalThis.performance.mark('interactive');
        if (typeof globalThis?.performance?.measure === 'function') {
          globalThis.performance.measure('tt_interactive', 'app_start', 'interactive');
        }
      }
      if (import.meta?.env?.DEV && typeof globalThis?.performance?.getEntriesByType === 'function') {
        const entries = globalThis.performance.getEntriesByType('measure');
        console.log(
          '[perf]',
          entries.map((e) => ({ name: e.name, ms: Math.round(e.duration) })),
        );
      }
    } catch {}
  }, [bootstrap.data, openInTelegram]);

  const onSaveEnvs = async (raw) => {
    const result = await envs.save(raw);
    const ok = typeof result === 'boolean' ? result : !!result?.ok;
    if (ok && result?.selected) {
      bootstrap.setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          selectedEnvs: result.selected,
          prodEnvironmentsText: result.selected.join(', '),
        };
      });
      hapticSuccess();
    } else if (!ok) {
      hapticError();
    }
    return result;
  };

  return (
    <div className="tg-page">
      <div className="min-h-[100dvh] overflow-y-auto overscroll-none">
        <div className="tg-container space-y-4" data-ui="react">
          <Header />

          <ListSection>
            {openInTelegram ? (
              <div className="px-4 py-3">
                <InlineMessage type="error">Open this page from Telegram to continue.</InlineMessage>
              </div>
            ) : null}

            <InstallRow
              installed={!!bootstrap.data?.installed}
              url={bootstrap.data?.githubInstallUrl}
              tg={tg}
              loading={bootstrapLoading}
            />

            <VerifyRow
              running={selfRunning}
              result={selfResult}
              onRun={runSelf}
              disabled={!authed}
              loading={bootstrapLoading}
            />

            <EnvRow
              envText={envs.envText}
              setEnvText={envs.setEnvText}
              onSave={onSaveEnvs}
              saving={envs.saving}
              recentlySaved={envs.recentlySaved}
              disabled={!authed}
              errorMessage={envs.apiError}
              loading={bootstrapLoading}
            />
          </ListSection>
        </div>
      </div>
    </div>
  );
}

const container = document.getElementById('app-react');
if (!container) {
  throw new Error('app container not found');
}
const root = createRoot(container);
root.render(<App />);
try {
  if (typeof globalThis?.requestAnimationFrame === 'function') {
    globalThis.requestAnimationFrame(() => {
      document.documentElement.classList.add('hydrated');
    });
  } else {
    document.documentElement.classList.add('hydrated');
  }
} catch {}

if (import.meta?.env?.DEV) {
  const logBox = (el, label) => {
    if (!el) return;
    const cs = globalThis.getComputedStyle ? globalThis.getComputedStyle(el) : null;
    const rect = el.getBoundingClientRect();
    const info = {
      label,
      width: cs?.width,
      paddingLeft: cs?.paddingLeft,
      paddingRight: cs?.paddingRight,
      borderLeft: cs?.borderLeftWidth,
      borderRight: cs?.borderRightWidth,
      marginLeft: cs?.marginLeft,
      marginRight: cs?.marginRight,
      boxSizing: cs?.boxSizing,
      fontFamily: cs?.fontFamily,
      fontSize: cs?.fontSize,
      fontWeight: cs?.fontWeight,
      lineHeight: cs?.lineHeight,
      letterSpacing: cs?.letterSpacing,
      rectLeft: Math.round(rect.left),
      rectTop: Math.round(rect.top),
      rectWidth: Math.round(rect.width),
      rectHeight: Math.round(rect.height),
      clientWidth: el.clientWidth,
      offsetWidth: el.offsetWidth,
    };
    console.table(info);
  };

  const logChain = (label, nodes) => {
    nodes.forEach((node, idx) => logBox(node, `${label}[${idx}] ${node?.nodeName || ''}`));
  };

  setTimeout(() => {
    const shell = document.querySelector('[data-ui="shell"]');
    const react = document.querySelector('[data-ui="react"]');
    const html = document.documentElement;
    const body = document.body;
    const app = document.getElementById('app');
    const page = react ? react.closest('.tg-page') : null;

    logBox(shell, 'shell .tg-container');
    logBox(react, 'react .tg-container');
    logChain('shell chain', [html, body, app, shell]);
    logChain('react chain', [html, body, app, page, react]);
  }, 0);
}
