import { ListRow } from './ListRow.jsx';
import { InlineMessage } from './InlineMessage.jsx';

function Checklist({ checklist }) {
  const entries = Object.entries(checklist || {});
  return (
    <ul className="mt-2 space-y-1">
      {entries.map(([k, v]) => (
        <li key={k} className="flex items-center gap-2 text-sm">
          <span className={v ? 'text-green-600' : 'text-red-600'}>{v ? '✓' : '✗'}</span>
          <span>{k}</span>
        </li>
      ))}
    </ul>
  );
}

export function VerifyRow({ running, result, onRun, disabled, loading = false }) {
  const button = (
    <button className="tg-btn-primary tg-btn-fixed" onClick={onRun} disabled={running || loading || !!disabled}>
      {running ? 'Verifying…' : 'Verify'}
    </button>
  );
  let body = null;
  if (loading && !result) {
    body = <div className="tg-skeleton tg-skeleton-text" aria-hidden="true" />;
  } else if (!result) {
    body = <InlineMessage type="info">No checks run yet.</InlineMessage>;
  } else if (result?.checklist && typeof result.checklist === 'object') {
    body = <Checklist checklist={result.checklist} />;
  } else {
    body = (
      <details>
        <summary>View details</summary>
        <pre className="tg-pre text-xs">{JSON.stringify(result, null, 2)}</pre>
      </details>
    );
  }
  return (
    <ListRow title="Verify" subtitle="Run a quick self-test for events and metrics." right={button}>
      {body}
    </ListRow>
  );
}
