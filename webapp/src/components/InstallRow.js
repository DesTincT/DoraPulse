import React from 'https://esm.sh/react@18';
import { ListRow } from '/webapp/src/components/ListRow.js';
import { StatusDot } from '/webapp/src/components/StatusDot.js';

export function InstallRow({ installed, url, tg }) {
  const status = React.createElement(StatusDot, {
    ok: !!installed,
    label: installed ? 'Installed' : 'Not installed',
  });
  const button = React.createElement(
    'button',
    {
      className: 'btn btn-sm rounded-full bg-[#2AABEE] hover:bg-[#229ED9] border-none text-white disabled:opacity-50',
      onClick: () => {
        if (!url) return;
        try {
          if (tg?.openLink) tg.openLink(url);
          else window.open(url, '_blank');
        } catch {
          window.open(url, '_blank');
        }
      },
      disabled: !url,
    },
    installed ? 'Reinstall' : 'Install',
  );
  return React.createElement(ListRow, {
    title: 'Install GitHub App',
    subtitle: 'Choose repositories and grant access.',
    right: React.createElement(React.Fragment, null, status, button),
  });
}
