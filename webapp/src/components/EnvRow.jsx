import { useEffect, useState } from 'react';
import { ListRow } from './ListRow.jsx';
import { InlineMessage } from './InlineMessage.jsx';

export function EnvRow({
  envText,
  setEnvText,
  onSave,
  saving,
  recentlySaved,
  disabled,
  errorMessage,
  loading = false,
}) {
  const [local, setLocal] = useState(envText || '');
  useEffect(() => setLocal(envText || ''), [envText]);
  const showSkeleton = loading && !envText;

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
          className="tg-btn-primary tg-btn-fixed"
          onClick={async () => {
            // Save MUST use the current input value (envText state update is async).
            const result = await onSave(local);
            const ok = typeof result === 'boolean' ? result : !!result?.ok;
            if (ok) setEnvText(local);
          }}
          disabled={saving || loading || !!disabled}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      }
      last={true}
    >
      <>
        <input
          className="tg-input"
          placeholder={loading ? 'Loading…' : 'production'}
          value={local}
          disabled={loading || !!disabled}
          onChange={(e) => setLocal(e.target.value)}
        />
        {showSkeleton ? (
          <div className="mt-2">
            <div className="tg-skeleton tg-skeleton-text" aria-hidden="true" />
          </div>
        ) : (
          <div className="mt-1 text-[12px] leading-4 tg-hint">Example: production, Yandex Cloud</div>
        )}
        {err}
        {footer}
      </>
    </ListRow>
  );
}
