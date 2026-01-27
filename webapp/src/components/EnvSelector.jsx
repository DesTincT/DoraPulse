export function EnvSelector({ envs, setEnvs, onReload, onSave, saving }) {
  const seenEnvs = envs?.seenEnvs || [];

  return (
    <div className="card bg-base-100 shadow p-4">
      <h2 className="card-title">Production Environments</h2>

      <div className="mt-2 flex flex-wrap gap-2">
        {seenEnvs.map((env) => (
          <label className="label cursor-pointer gap-2" key={env}>
            <input
              type="checkbox"
              className="checkbox"
              checked={envs.selected?.includes(env)}
              onChange={(e) => {
                const sel = new Set(envs.selected || []);
                if (e.target.checked) sel.add(env);
                else sel.delete(env);
                setEnvs({ ...envs, selected: Array.from(sel) });
              }}
            />
            <span className="label-text">{env}</span>
          </label>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button className="btn" onClick={onReload}>
          Reload
        </button>
        <button className="btn btn-primary" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
