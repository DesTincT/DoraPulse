export function ConnectCard({ me, onInstall }) {
  const installed = !!me?.github?.installationId;
  return (
    <div className="card bg-base-100 shadow p-4">
      <h2 className="card-title">Connect GitHub App</h2>
      <p>{installed ? 'Installed ✓' : 'Not installed'}</p>
      {installed ? null : (
        <div className="mt-2">
          <button className="btn btn-primary" onClick={onInstall} disabled={!me?.githubInstallUrl}>
            Install GitHub App
          </button>
        </div>
      )}
    </div>
  );
}

