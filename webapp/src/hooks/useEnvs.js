import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../api/client.js';

export function useEnvs(initData, opts = {}) {
  const autoLoad = opts.autoLoad !== false;
  const initial = opts.initial || null;
  const [envs, setEnvs] = useState(() => ({
    seenEnvs: Array.isArray(initial?.seenEnvs) ? initial.seenEnvs : [],
    selected: Array.isArray(initial?.selectedEnvs) ? initial.selectedEnvs : [],
  }));
  const [envText, setEnvText] = useState(() => {
    const selected = Array.isArray(initial?.selectedEnvs) ? initial.selectedEnvs : [];
    return selected.length ? selected.join(', ') : '';
  });
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

  async function save(rawOverride) {
    try {
      setSaving(true);
      setError(null);
      setApiError(null);
      const raw = typeof rawOverride === 'string' ? rawOverride : envText;
      const parts = String(raw || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      // dedupe case-insensitive
      const dedup = Array.from(new Map(parts.map((p) => [p.toLowerCase(), p])).values());
      if (!dedup.length) {
        setApiError('Please enter at least one environment (comma-separated).');
        return { ok: false };
      }
      await apiPost('/api/envs', { selected: dedup }, initData);
      setEnvs((prev) => ({ ...prev, selected: dedup }));
      setEnvText(dedup.join(', '));
      setSavedAt(Date.now());
      return { ok: true, selected: dedup };
    } catch (e) {
      setError(e);
      return { ok: false };
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const nextSelected = Array.isArray(initial?.selectedEnvs) ? initial.selectedEnvs : [];
    const nextSeen = Array.isArray(initial?.seenEnvs) ? initial.seenEnvs : [];
    setEnvs({ seenEnvs: nextSeen, selected: nextSelected });
    setEnvText(nextSelected.length ? nextSelected.join(', ') : '');
  }, [initial?.selectedEnvs, initial?.seenEnvs]);

  useEffect(() => {
    if (!autoLoad) return;
    if (!initData) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, initData]);

  const recentlySaved = useMemo(() => {
    if (!savedAt) return false;
    return Date.now() - savedAt < 2500;
  }, [savedAt]);

  return { envs, envText, setEnvText, load, save, loading, saving, error, apiError, recentlySaved };
}
