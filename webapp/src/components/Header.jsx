export function Header({ onRefresh, disabled, telegramDetected, initDataLen }) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <div className="text-xl font-semibold">Dora Pulse Setup</div>
        <div className="text-sm text-base-content/60">Connect GitHub, verify events, set production environments</div>
        <div className="text-xs text-base-content/50 mt-1">
          {`Telegram: ${telegramDetected ? 'yes' : 'no'} · initData: ${initDataLen || 0}`}
        </div>
      </div>

      <button className="btn btn-outline btn-sm" onClick={onRefresh} disabled={disabled}>
        Refresh
      </button>
    </div>
  );
}
