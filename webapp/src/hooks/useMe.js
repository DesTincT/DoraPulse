import React, { useEffect, useState } from 'https://esm.sh/react@18';
import { apiGet } from '/webapp/src/api/client.js';

export function useMe(initData) {
  const [me, setMe] = useState(null);
  const [githubInstallUrl, setGithubInstallUrl] = useState(null);
  const [github, setGithub] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const r = await apiGet('/api/me', initData);
      setMe(r?.project || null);
      setGithub(r?.github || null);
      setGithubInstallUrl(r?.githubInstallUrl || null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initData]);

  return { me, github, githubInstallUrl, reload: load, loading, error, setMe };
}
