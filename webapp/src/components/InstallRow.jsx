import { ListRow } from './ListRow.jsx';
import { StatusDot } from './StatusDot.jsx';

export function InstallRow({ installed, url, tg }) {
  const status = <StatusDot ok={!!installed} label={installed ? 'Installed ✓' : 'Not installed'} />;

  const button = installed ? null : (
    <button
      className="btn btn-sm rounded-full bg-[#2AABEE] hover:bg-[#229ED9] border-none text-white disabled:opacity-50"
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

