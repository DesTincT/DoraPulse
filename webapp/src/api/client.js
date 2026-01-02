export async function apiGet(path, initData) {
  const res = await fetch(path, {
    headers: { 'x-telegram-init-data': initData },
  });
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);
  if (res.ok) return payload;
  if (res.status === 401 && payload && typeof payload === 'object') return payload;
  throw new Error(
    `GET ${path} failed: ${res.status} ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`,
  );
}

export async function apiPost(path, body, initData) {
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-telegram-init-data': initData,
    },
    body: JSON.stringify(body || {}),
  });
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);
  if (res.ok) return payload;
  if (res.status === 401 && payload && typeof payload === 'object') return payload;
  throw new Error(
    `POST ${path} failed: ${res.status} ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`,
  );
}
