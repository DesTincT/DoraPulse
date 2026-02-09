import { ListRow } from './ListRow.jsx';
import { StatusDot } from './StatusDot.jsx';

export function InstallRow({ installed, url, tg, loading = false }) {
  const statusLabel = loading ? (
    <span className="tg-skeleton tg-skeleton-text" aria-hidden="true" />
  ) : installed ? (
    'Installed'
  ) : (
    'Not installed'
  );
  const status = <StatusDot ok={!!installed && !loading} label={statusLabel} />;
  const buttonLabel = loading ? 'Loading…' : installed ? 'Installed' : 'Install';
  const buttonDisabled = loading || installed || !url;

  const button = (
    <button
      className="tg-btn-primary tg-btn-fixed"
      onClick={() => {
        if (!url || installed || loading) return;
        try {
          if (tg?.openLink) tg.openLink(url);
          else window.open(url, '_blank');
        } catch {
          window.open(url, '_blank');
        }
      }}
      disabled={buttonDisabled}
    >
      {buttonLabel}
    </button>
  );

  return (
    <ListRow
      title="Install GitHub App"
      subtitle="Choose repositories and grant access."
      right={
        <>
          {status}
          {button}
        </>
      }
    />
  );
}
