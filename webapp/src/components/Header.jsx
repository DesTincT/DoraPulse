export function Header({ onRefresh, disabled, telegramDetected, initDataLen }) {
  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-2">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xl font-semibold">Dora Pulse Setup</div>
          <div className="text-sm text-base-content/60">Connect GitHub, verify events, set production environments</div>
          <div className="text-xs text-base-content/50 mt-1">
            {`Telegram: ${telegramDetected ? 'yes' : 'no'} · initData: ${initDataLen || 0}`}
          </div>
        </div>

        <button
          className="btn btn-sm rounded-full bg-[#2AABEE] hover:bg-[#229ED9] border-none text-white disabled:opacity-50"
          onClick={onRefresh}
          disabled={disabled}
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

