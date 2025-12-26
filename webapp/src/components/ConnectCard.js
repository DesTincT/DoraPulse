export function ConnectCard({ me, onInstall }) {
  return React.createElement(
    'div',
    { className: 'card bg-base-100 shadow p-4' },
    React.createElement('h2', { className: 'card-title' }, 'Connect GitHub App'),
    React.createElement('p', null, me?.github?.installationId ? 'Installed ✓' : 'Not installed'),
    React.createElement(
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
