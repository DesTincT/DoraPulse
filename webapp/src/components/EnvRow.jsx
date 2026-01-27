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
          className="tg-btn-primary"
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
          className="tg-input"
          placeholder="production"
          value={local}
          disabled={!!disabled}
          onChange={(e) => setLocal(e.target.value)}
        />
        <div className="mt-1 text-[12px] leading-4 tg-hint">Example: production, Yandex Cloud</div>
        {err}
        {footer}
      </>
    </ListRow>
  );
}
