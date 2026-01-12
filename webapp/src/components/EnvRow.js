import React, { useState, useEffect } from 'https://esm.sh/react@18';
import { ListRow } from '/webapp/src/components/ListRow.js';
import { InlineMessage } from '/webapp/src/components/InlineMessage.js';

export function EnvRow({ envText, setEnvText, onSave, saving, recentlySaved, disabled, errorMessage }) {
  const [local, setLocal] = useState(envText || '');
  useEffect(() => setLocal(envText || ''), [envText]);

  const input = React.createElement('input', {
    className: 'input input-bordered w-full',
    placeholder: 'production',
    value: local,
    disabled: !!disabled,
    onChange: (e) => setLocal(e.target.value),
  });
  const hint = React.createElement(
    'div',
    { className: 'text-xs text-base-content/60 mt-1' },
    'Example: production, Yandex Cloud',
  );
  const body = React.createElement(React.Fragment, null, input, hint);
  const button = React.createElement(
    'button',
    {
      className: 'btn btn-sm rounded-full bg-[#2AABEE] hover:bg-[#229ED9] border-none text-white disabled:opacity-50',
      onClick: async () => {
        // Save MUST use the current input value (envText state update is async).
        const ok = await onSave(local);
        if (ok) setEnvText(local);
      },
      disabled: saving || !!disabled,
    },
    saving ? 'Saving…' : 'Save',
  );
  const right = React.createElement(React.Fragment, null, button);
  const footer = recentlySaved ? React.createElement(InlineMessage, { type: 'success' }, 'Saved') : null;
  const err =
    errorMessage && errorMessage !== 'open_in_telegram'
      ? React.createElement(InlineMessage, { type: 'error' }, String(errorMessage))
      : null;
  return React.createElement(
    ListRow,
    {
      title: 'Production environments',
      subtitle: 'Comma-separated values used to count production deployments.',
      right,
      last: true,
    },
    React.createElement(React.Fragment, null, body, err, footer),
  );
}
