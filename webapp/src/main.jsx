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
  const { tg, initData } = useTelegram();
  const me = useMe(initData);
  const envs = useEnvs(initData);
  const self = useSelfTest(initData);

  const authed = !!me.ok;

  const openInTelegram = !authed && (me.apiError === 'open_in_telegram' || envs.apiError === 'open_in_telegram');

  return (
    <div className="tg-page">
      <div className="min-h-[100dvh] overflow-y-auto overscroll-none">
        <div className="tg-container space-y-4">
          <Header />

          <ListSection>
            {openInTelegram ? (
              <div className="px-4 py-3">
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
    </div>
  );
}

const container = document.getElementById('app');
if (!container) {
  throw new Error('app container not found');
}
const root = createRoot(container);
root.render(<App />);
