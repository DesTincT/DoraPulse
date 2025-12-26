import React, { useMemo, useState } from 'https://esm.sh/react@18';
import ReactDOM from 'https://esm.sh/react-dom@18/client';
import { useTelegram } from '/webapp/src/hooks/useTelegram.js';
import { useFetch } from '/webapp/src/hooks/useFetch.js';
import { apiGet, apiPost } from '/webapp/src/api/client.js';
import { Tabs } from '/webapp/src/components/Tabs.js';
import { ConnectCard } from '/webapp/src/components/ConnectCard.js';
import { SelfTestCard } from '/webapp/src/components/SelfTestCard.js';
import { EnvSelector } from '/webapp/src/components/EnvSelector.js';
import { Alert } from '/webapp/src/components/Alert.js';

function App() {
  const { tg, initData } = useTelegram();
  const [tab, setTab] = useState('connect');

  const meFetch = useFetch(() => apiGet('/api/me', initData), [initData]);
  const envsFetch = useFetch(() => apiGet('/api/envs', initData), [initData]);
  const [selfTest, setSelfTest] = useState({ loading: false, data: null, error: null });
  const [savingEnvs, setSavingEnvs] = useState(false);
  const projectName = meFetch.data?.project?.name || 'Project';

  function refreshAll() {
    void meFetch.reload();
    void envsFetch.reload();
  }

  const onInstall = () => {
    const url = meFetch.data?.githubInstallUrl;
    if (!url) return;
    try {
      if (tg?.openLink) tg.openLink(url);
      else window.open(url, '_blank');
    } catch {
      window.open(url, '_blank');
    }
  };

  async function runSelfTest() {
    try {
      setSelfTest({ loading: true, data: null, error: null });
      const r = await apiPost('/api/selftest', {}, initData);
      setSelfTest({ loading: false, data: r, error: null });
    } catch (e) {
      setSelfTest({ loading: false, data: null, error: e });
    }
  }

  async function saveEnvs() {
    try {
      setSavingEnvs(true);
      await apiPost('/api/envs', { selected: envsFetch.data?.selected || [] }, initData);
    } catch (e) {
      // no-op; surface error via alert
    } finally {
      setSavingEnvs(false);
    }
  }

  const header = React.createElement(
    'div',
    { className: 'navbar bg-base-100 mb-4 rounded-box shadow' },
    React.createElement(
      'div',
      { className: 'flex-1' },
      React.createElement('span', { className: 'text-lg font-semibold' }, projectName),
    ),
    React.createElement(
      'div',
      { className: 'flex-none' },
      React.createElement(
        'button',
        { className: 'btn btn-ghost', onClick: refreshAll, disabled: meFetch.loading || envsFetch.loading },
        'Refresh',
      ),
    ),
  );

  const errors = meFetch.error || envsFetch.error || selfTest.error;
  const alert = errors ? React.createElement(Alert, { type: 'error' }, String(errors?.message || 'Error')) : null;

  const connect = React.createElement(ConnectCard, { me: meFetch.data, onInstall });
  const verify = React.createElement(SelfTestCard, {
    loading: selfTest.loading,
    data: selfTest.data,
    onRun: runSelfTest,
  });
  const env = React.createElement(EnvSelector, {
    envs: envsFetch.data || { seenEnvs: [], selected: [] },
    setEnvs: (v) => envsFetch.setData(v),
    onReload: envsFetch.reload,
    onSave: saveEnvs,
    saving: savingEnvs,
  });

  const body = tab === 'connect' ? connect : tab === 'verify' ? verify : env;
  return React.createElement(
    'div',
    null,
    header,
    React.createElement(Tabs, { value: tab, onChange: setTab }),
    alert,
    meFetch.loading && React.createElement('div', { className: 'loading loading-spinner loading-md' }),
    !meFetch.loading && body,
  );
}

const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(React.createElement(App));
