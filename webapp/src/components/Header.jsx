export function Header({ onRefresh, disabled, telegramDetected, initDataLen }) {
  return (
    <div className="tg-header">
      <div>
        <div className="tg-title">Dora Pulse Setup</div>
        <div className="tg-subtitle">Connect GitHub, verify events, set production environments</div>
        <div className="tg-meta">{`Telegram: ${telegramDetected ? 'yes' : 'no'} · initData: ${initDataLen || 0}`}</div>
      </div>

      <button className="tg-btn-secondary" onClick={onRefresh} disabled={disabled}>
        Refresh
      </button>
    </div>
  );
}
