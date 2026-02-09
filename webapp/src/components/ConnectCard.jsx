export function ConnectCard({ me, onInstall }) {
  const installed =
    !!me?.github?.installationId ||
    !!me?.github?.installed ||
    !!me?.installed ||
    !!me?.installationId ||
    me?.installed === true;

  const canInstall = !!me?.githubInstallUrl;
  const loading = !me || me.loading === true || me.status === 'loading';

  const buttonLabel = loading ? 'Loading…' : installed ? 'Installed' : 'Install GitHub App';
  const buttonDisabled = loading || installed || !canInstall;

  return (
    <div className="card bg-base-100 shadow p-4">
      <h2 className="card-title">Connect GitHub App</h2>
      <p>{loading ? 'Checking…' : installed ? 'Installed' : 'Not installed'}</p>

      <div className="mt-2 min-h-[48px] flex items-center">
        <button
          type="button"
          className="btn btn-primary btn-md min-w-[200px] transition-opacity"
          onClick={onInstall}
          disabled={buttonDisabled}
          aria-busy={loading ? 'true' : undefined}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
