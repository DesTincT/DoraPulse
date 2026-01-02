import React from 'https://esm.sh/react@18';
import { ListRow } from '/webapp/src/components/ListRow.js';
import { InlineMessage } from '/webapp/src/components/InlineMessage.js';

function Checklist({ checklist }) {
  const entries = Object.entries(checklist || {});
  return React.createElement(
    'ul',
    { className: 'mt-2 space-y-1' },
    ...entries.map(([k, v]) =>
      React.createElement(
        'li',
        { key: k, className: 'flex items-center gap-2 text-sm' },
        React.createElement('span', { className: v ? 'text-green-600' : 'text-red-600' }, v ? '✓' : '✗'),
        React.createElement('span', null, k),
      ),
    ),
  );
}

export function VerifyRow({ running, result, onRun, disabled }) {
  const button = React.createElement(
    'button',
    {
      className: 'btn btn-sm rounded-full bg-[#2AABEE] hover:bg-[#229ED9] border-none text-white disabled:opacity-50',
      onClick: onRun,
      disabled: running || !!disabled,
    },
    running ? 'Verifying…' : 'Verify',
  );
  let body = null;
  if (!result) {
    body = React.createElement(InlineMessage, { type: 'info' }, 'No checks run yet.');
  } else if (result?.checklist && typeof result.checklist === 'object') {
    body = React.createElement(Checklist, { checklist: result.checklist });
  } else {
    body = React.createElement(
      'details',
      null,
      React.createElement('summary', null, 'View details'),
      React.createElement('pre', { className: 'text-xs whitespace-pre-wrap' }, JSON.stringify(result, null, 2)),
    );
  }
  return React.createElement(
    ListRow,
    {
      title: 'Verify',
      subtitle: 'Run a quick self-test for events and metrics.',
      right: button,
    },
    body,
  );
}
