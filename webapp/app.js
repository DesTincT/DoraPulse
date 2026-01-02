import React from 'https://esm.sh/react@18';
import ReactDOM from 'https://esm.sh/react-dom@18/client';
import { useTelegram } from '/webapp/src/hooks/useTelegram.js';
import { useMe } from '/webapp/src/hooks/useMe.js';
import { useEnvs } from '/webapp/src/hooks/useEnvs.js';
import { useSelfTest } from '/webapp/src/hooks/useSelfTest.js';
import { Header } from '/webapp/src/components/Header.js';
import { ListSection } from '/webapp/src/components/ListSection.js';
import { InstallRow } from '/webapp/src/components/InstallRow.js';
import { VerifyRow } from '/webapp/src/components/VerifyRow.js';
import { EnvRow } from '/webapp/src/components/EnvRow.js';
import { InlineMessage } from '/webapp/src/components/InlineMessage.js';

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

  return React.createElement(
    'div',
    { className: 'h-[100dvh] bg-base-200 overflow-hidden' },
    React.createElement(
      'div',
      { className: 'h-full overflow-y-auto overscroll-none' },
      React.createElement(Header, {
        onRefresh: refreshAll,
        disabled: me.loading || envs.loading,
        telegramDetected: detected,
        initDataLen,
      }),
      React.createElement(
        ListSection,
        null,
        !authed && (me.apiError === 'open_in_telegram' || envs.apiError === 'open_in_telegram')
          ? React.createElement(
              'div',
              { className: 'px-1 py-3' },
              React.createElement(InlineMessage, { type: 'error' }, 'Open this page from Telegram to continue.'),
            )
          : null,
        React.createElement(InstallRow, {
          installed: !!me.installed,
          url: me.githubInstallUrl,
          tg,
        }),
        React.createElement(VerifyRow, {
          running: self.running,
          result: self.result,
          onRun: self.run,
          disabled: !authed,
        }),
        React.createElement(EnvRow, {
          envText: envs.envText,
          setEnvText: envs.setEnvText,
          onSave: envs.save,
          saving: envs.saving,
          recentlySaved: envs.recentlySaved,
          disabled: !authed,
        }),
      ),
    ),
  );
}

const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(React.createElement(App));
