export function EnvSelector({ envs, setEnvs, onReload, onSave, saving }) {
  return React.createElement(
    'div',
    { className: 'card bg-base-100 shadow p-4' },
    React.createElement('h2', { className: 'card-title' }, 'Production Environments'),
    React.createElement(
      'div',
      { className: 'mt-2 flex flex-wrap gap-2' },
      ...(envs?.seenEnvs || []).map((env) =>
        React.createElement(
          'label',
          { className: 'label cursor-pointer gap-2', key: env },
          React.createElement('input', {
            type: 'checkbox',
            className: 'checkbox',
            checked: envs.selected?.includes(env),
            onChange: (e) => {
              const sel = new Set(envs.selected || []);
              if (e.target.checked) sel.add(env);
              else sel.delete(env);
              setEnvs({ ...envs, selected: Array.from(sel) });
            },
          }),
          React.createElement('span', { className: 'label-text' }, env),
        ),
      ),
    ),
    React.createElement(
      'div',
      { className: 'mt-3 flex gap-2' },
      React.createElement('button', { className: 'btn', onClick: onReload }, 'Reload'),
      React.createElement(
        'button',
        { className: 'btn btn-primary', onClick: onSave, disabled: saving },
        saving ? 'Saving…' : 'Save',
      ),
    ),
  );
}
