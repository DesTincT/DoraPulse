import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet } from '../api/client.js';

const CACHE_KEY = 'dora_bootstrap_v1';
const DEFAULT_TTL_MS = 30 * 60 * 1000;

function readCache(ttlMs) {
  try {
    const storage = globalThis?.localStorage;
    if (!storage) return null;
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const ts = Number(parsed.ts || 0);
    if (!ts || Date.now() - ts > ttlMs) return null;
    if (!parsed.data || typeof parsed.data !== 'object') return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    const payload = JSON.stringify({ ts: Date.now(), data });
    const storage = globalThis?.localStorage;
    if (!storage) return;
    storage.setItem(CACHE_KEY, payload);
  } catch {}
}

export function useBootstrap(initData, opts = {}) {
  const ttlMs = typeof opts.ttlMs === 'number' ? opts.ttlMs : DEFAULT_TTL_MS;
  const autoRefresh = opts.autoRefresh === true;
  const minIntervalMs = typeof opts.minIntervalMs === 'number' ? opts.minIntervalMs : 1200;
  const [data, setData] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const lastRefreshRef = useRef(0);
  const cacheMarkedRef = useRef(false);
  const loadedMarkedRef = useRef(false);

  const initMissing = !initData;

  const applyData = useCallback((payload, { cache = true } = {}) => {
    if (!payload || typeof payload !== 'object') return;
    setData(payload);
    if (cache) writeCache(payload);
  }, []);

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      if (!initData) {
        if (!silent) setLoading(false);
        return;
      }
      try {
        if (!silent) setLoading(true);
        setError(null);
        const payload = await apiGet('/api/bootstrap', initData);
        if (!mountedRef.current) return;
        if (payload?.ok === false && payload?.error) {
          setError(String(payload.error));
          if (!silent) setLoading(false);
          return;
        }
        applyData(payload);
        if (!loadedMarkedRef.current && typeof globalThis?.performance?.mark === 'function') {
          globalThis.performance.mark('bootstrap_loaded');
          if (typeof globalThis?.performance?.measure === 'function') {
            globalThis.performance.measure('tt_bootstrap', 'app_start', 'bootstrap_loaded');
          }
          loadedMarkedRef.current = true;
        }
        if (!silent) setLoading(false);
      } catch (e) {
        if (!mountedRef.current) return;
        setError(e);
        if (!silent) setLoading(false);
      }
    },
    [applyData, initData],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const cached = readCache(ttlMs);
    if (cached) {
      setData(cached);
      setFromCache(true);
      setLoading(false);
      if (!cacheMarkedRef.current && typeof globalThis?.performance?.mark === 'function') {
        globalThis.performance.mark('bootstrap_cache_hit');
        if (typeof globalThis?.performance?.measure === 'function') {
          globalThis.performance.measure('tt_cache_hit', 'app_start', 'bootstrap_cache_hit');
        }
        cacheMarkedRef.current = true;
      }
      void refresh({ silent: true });
      return;
    }
    void refresh();
  }, [refresh, ttlMs]);

  useEffect(() => {
    if (!autoRefresh) return;
    if (!initData) return;
    const maybeRefresh = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastRefreshRef.current < minIntervalMs) return;
      lastRefreshRef.current = now;
      void refresh({ silent: true });
    };
    window.addEventListener('focus', maybeRefresh);
    document.addEventListener('visibilitychange', maybeRefresh);
    return () => {
      window.removeEventListener('focus', maybeRefresh);
      document.removeEventListener('visibilitychange', maybeRefresh);
    };
  }, [autoRefresh, initData, minIntervalMs, refresh]);

  const setDataAndCache = useCallback(
    (next) => {
      setData((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        if (resolved) writeCache(resolved);
        return resolved;
      });
    },
    [setData],
  );

  return useMemo(
    () => ({
      data,
      loading,
      error,
      fromCache,
      initMissing,
      refresh,
      setData: setDataAndCache,
      applyData,
    }),
    [applyData, data, error, fromCache, initMissing, loading, refresh, setDataAndCache],
  );
}
