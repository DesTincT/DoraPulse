const DEFAULT_TIMEOUT_MS = 12000;

function buildSignal(opts = {}) {
  if (opts.signal) return { signal: opts.signal, cleanup: null };
  const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;
  const controller = globalThis?.AbortController ? new globalThis.AbortController() : null;
  if (!controller) return { signal: undefined, cleanup: null };
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, cleanup: () => clearTimeout(timeoutId) };
}

export async function apiGet(path, initData, opts = {}) {
  const { signal, cleanup } = buildSignal(opts);
  const res = await fetch(path, {
    headers: { 'x-telegram-init-data': initData },
    signal,
  });
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);
  if (cleanup) cleanup();
  if (res.ok) return payload;
  if (res.status === 401 && payload && typeof payload === 'object') return payload;
  throw new Error(
    `GET ${path} failed: ${res.status} ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`,
  );
}

export async function apiPost(path, body, initData, opts = {}) {
  const { signal, cleanup } = buildSignal(opts);
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-telegram-init-data': initData,
    },
    body: JSON.stringify(body || {}),
    signal,
  });
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);
  if (cleanup) cleanup();
  if (res.ok) return payload;
  if (res.status === 401 && payload && typeof payload === 'object') return payload;
  throw new Error(
    `POST ${path} failed: ${res.status} ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`,
  );
}
