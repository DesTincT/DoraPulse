export function SelfTestCard({ loading, data, onRun }) {
  return (
    <div className="card bg-base-100 shadow p-4">
      <h2 className="card-title">Self-Test</h2>
      <p>{data ? JSON.stringify(data) : 'Run self-test to verify events and metrics.'}</p>
      <button className="btn mt-2" onClick={onRun} disabled={loading}>
        {loading ? 'Running…' : 'Run self-test'}
      </button>
    </div>
  );
}

