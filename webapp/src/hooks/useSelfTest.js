import React, { useState } from 'https://esm.sh/react@18';
import { apiPost } from '/webapp/src/api/client.js';

export function useSelfTest(initData) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function run() {
    try {
      setRunning(true);
      setError(null);
      const r = await apiPost('/api/selftest', {}, initData);
      setResult(r);
    } catch (e) {
      setError(e);
    } finally {
      setRunning(false);
    }
  }

  return { run, running, result, error };
}


