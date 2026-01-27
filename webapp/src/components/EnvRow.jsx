import { useEffect, useState } from 'react';
import { ListRow } from './ListRow.jsx';
import { InlineMessage } from './InlineMessage.jsx';

export function EnvRow({ envText, setEnvText, onSave, saving, recentlySaved, disabled, errorMessage }) {
  const [local, setLocal] = useState(envText || '');
  useEffect(() => setLocal(envText || ''), [envText]);

  const footer = recentlySaved ? <InlineMessage type="success">Saved</InlineMessage> : null;
  const err =
    errorMessage && errorMessage !== 'open_in_telegram' ? (
      <InlineMessage type="error">{String(errorMessage)}</InlineMessage>
    ) : null;

  return (
    <ListRow
      title="Production environments"
      subtitle="Comma-separated values used to count production deployments."
      right={
        <button
          className="btn btn-sm rounded-full bg-[#2AABEE] hover:bg-[#229ED9] border-none text-white disabled:opacity-50"
          onClick={async () => {
            // Save MUST use the current input value (envText state update is async).
            const ok = await onSave(local);
            if (ok) setEnvText(local);
          }}
          disabled={saving || !!disabled}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      }
      last={true}
    >
      <>
        <input
          className="input input-bordered w-full"
          placeholder="production"
          value={local}
          disabled={!!disabled}
          onChange={(e) => setLocal(e.target.value)}
        />
        <div className="text-xs text-base-content/60 mt-1">Example: production, Yandex Cloud</div>
        {err}
        {footer}
      </>
    </ListRow>
  );
}

