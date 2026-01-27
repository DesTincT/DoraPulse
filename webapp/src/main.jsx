import { createRoot } from 'react-dom/client';
import './styles.css';
import { useTelegram } from './hooks/useTelegram.js';
import { useMe } from './hooks/useMe.js';
import { useEnvs } from './hooks/useEnvs.js';
import { useSelfTest } from './hooks/useSelfTest.js';
import { Header } from './components/Header.jsx';
import { ListSection } from './components/ListSection.jsx';
import { InstallRow } from './components/InstallRow.jsx';
import { VerifyRow } from './components/VerifyRow.jsx';
import { EnvRow } from './components/EnvRow.jsx';
import { InlineMessage } from './components/InlineMessage.jsx';

function App() {
  const { tg, initData, detected, initDataLen } = useTelegram();
  const me = useMe(initData);
  const envs = useEnvs(initData);
  const self = useSelfTest(initData);

  const authed = !!me.ok;
  const refreshAll = () => {
    void me.reload();
    void envs.load();
  };

  const openInTelegram = !authed && (me.apiError === 'open_in_telegram' || envs.apiError === 'open_in_telegram');

  return (
    <div className="h-[100dvh] bg-base-200 overflow-hidden">
      <div className="h-full overflow-y-auto overscroll-none">
        <Header
          onRefresh={refreshAll}
          disabled={me.loading || envs.loading}
          telegramDetected={detected}
          initDataLen={initDataLen}
        />
        <ListSection>
          {openInTelegram ? (
            <div className="px-1 py-3">
              <InlineMessage type="error">Open this page from Telegram to continue.</InlineMessage>
            </div>
          ) : null}

          <InstallRow installed={!!me.installed} url={me.githubInstallUrl} tg={tg} />

          <VerifyRow running={self.running} result={self.result} onRun={self.run} disabled={!authed} />

          <EnvRow
            envText={envs.envText}
            setEnvText={envs.setEnvText}
            onSave={envs.save}
            saving={envs.saving}
            recentlySaved={envs.recentlySaved}
            disabled={!authed}
            errorMessage={envs.apiError}
          />
        </ListSection>
      </div>
    </div>
  );
}

const container = document.getElementById('app');
if (!container) {
  throw new Error('app container not found');
}
const root = createRoot(container);
root.render(<App />);
