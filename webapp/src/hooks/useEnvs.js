import React, { useEffect, useMemo, useState } from 'https://esm.sh/react@18';
import { apiGet, apiPost } from '/webapp/src/api/client.js';

export function useEnvs(initData) {
  const [envs, setEnvs] = useState({ seenEnvs: [], selected: [] });
  const [envText, setEnvText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setApiError(null);
      const r = await apiGet('/api/envs', initData);
      if (r?.ok === false && r?.error) {
        setApiError(String(r.error));
        return;
      }
      setEnvs({ seenEnvs: r?.seenEnvs || [], selected: r?.selected || [] });
      const text = Array.isArray(r?.selected) ? r.selected.join(', ') : '';
      setEnvText(text);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    try {
      setSaving(true);
      setError(null);
      const parts = envText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      // dedupe case-insensitive
      const dedup = Array.from(new Map(parts.map((p) => [p.toLowerCase(), p])).values());
      await apiPost('/api/envs', { selected: dedup }, initData);
      setEnvs((prev) => ({ ...prev, selected: dedup }));
      setSavedAt(Date.now());
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initData]);

  const recentlySaved = useMemo(() => {
    if (!savedAt) return false;
    return Date.now() - savedAt < 2500;
  }, [savedAt]);

  return { envs, envText, setEnvText, load, save, loading, saving, error, apiError, recentlySaved };
}
