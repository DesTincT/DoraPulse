import React, { useEffect, useState } from 'https://esm.sh/react@18';
import { apiGet } from '/webapp/src/api/client.js';

export function useMe(initData) {
  const [me, setMe] = useState(null);
  const [githubInstallUrl, setGithubInstallUrl] = useState(null);
  const [github, setGithub] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [ok, setOk] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastLoadedAt, setLastLoadedAt] = useState(0);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setApiError(null);
      const r = await apiGet('/api/me', initData);
      // API returns { ok, projectId, installed, github, githubInstallUrl }
      setMe(r?.projectId ? { _id: r.projectId } : null);
      setGithub(r?.github || null);
      setGithubInstallUrl(r?.githubInstallUrl || null);
      setOk(!!r?.ok);
      setInstalled(!!r?.github?.installed || !!r?.installed || !!r?.github?.installationId);
      if (r?.ok === false && r?.error) setApiError(String(r.error));
      setLastLoadedAt(Date.now());
    } catch (e) {
      setError(e);
      setOk(false);
      setInstalled(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initData]);

  // Auto-refresh on return from GitHub installation flow (user leaves Telegram WebView and comes back).
  useEffect(() => {
    if (!initData) return;
    const minIntervalMs = 1200;
    const maybeReload = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      if (Date.now() - lastLoadedAt < minIntervalMs) return;
      void load();
    };
    window.addEventListener('focus', maybeReload);
    document.addEventListener('visibilitychange', maybeReload);
    return () => {
      window.removeEventListener('focus', maybeReload);
      document.removeEventListener('visibilitychange', maybeReload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initData, lastLoadedAt]);

  return { ok, apiError, installed, me, github, githubInstallUrl, reload: load, loading, error, setMe };
}
