import { ListRow } from './ListRow.jsx';
import { StatusPill } from './StatusPill.jsx';

export function InstallRow({ installed, url, tg, loading = false }) {
  const InstallState = {
    NOT_INSTALLED: 'NOT_INSTALLED',
    INSTALLING: 'INSTALLING',
    INSTALLED: 'INSTALLED',
  };
  const state = loading ? InstallState.INSTALLING : installed ? InstallState.INSTALLED : InstallState.NOT_INSTALLED;

  const onInstall = () => {
    if (!url || installed || loading) return;
    try {
      if (tg?.openLink) tg.openLink(url);
      else window.open(url, '_blank');
    } catch {
      window.open(url, '_blank');
    }
  };

  // Settings row pattern: only one right-side element (action OR status).
  let right = null;
  switch (state) {
    case InstallState.INSTALLING:
      right = (
        <button className="tg-action-btn" disabled={true}>
          <span className="tg-spinner" aria-hidden="true" />
          Installing…
        </button>
      );
      break;
    case InstallState.INSTALLED:
      right = <StatusPill text="Installed" icon="✓" />;
      break;
    case InstallState.NOT_INSTALLED:
    default:
      right = (
        <button className="tg-action-btn" onClick={onInstall} disabled={!url}>
          Install
        </button>
      );
      break;
  }

  return (
    <ListRow title="Install GitHub App" subtitle="Choose repositories and grant access." right={right} />
  );
}
