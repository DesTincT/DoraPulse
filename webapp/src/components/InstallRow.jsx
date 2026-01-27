import { ListRow } from './ListRow.jsx';
import { StatusDot } from './StatusDot.jsx';

export function InstallRow({ installed, url, tg }) {
  const status = <StatusDot ok={!!installed} label={installed ? 'Installed ✓' : 'Not installed'} />;

  const button = installed ? null : (
    <button
      className="tg-btn-primary"
      onClick={() => {
        if (!url) return;
        try {
          if (tg?.openLink) tg.openLink(url);
          else window.open(url, '_blank');
        } catch {
          window.open(url, '_blank');
        }
      }}
      disabled={!url}
    >
      Install
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
