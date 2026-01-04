import React from 'https://esm.sh/react@18';
export function ConnectCard({ me, onInstall }) {
  const installed = !!me?.github?.installationId;
  return React.createElement(
    'div',
    { className: 'card bg-base-100 shadow p-4' },
    React.createElement('h2', { className: 'card-title' }, 'Connect GitHub App'),
    React.createElement('p', null, installed ? 'Installed ✓' : 'Not installed'),
    installed
      ? null
      : React.createElement(
          'div',
          { className: 'mt-2' },
          React.createElement(
            'button',
            { className: 'btn btn-primary', onClick: onInstall, disabled: !me?.githubInstallUrl },
            'Install GitHub App',
          ),
        ),
  );
}
