import { useState } from 'react';
import { apiPost } from '../api/client.js';

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
