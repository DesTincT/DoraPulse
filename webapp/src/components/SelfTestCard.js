import React from 'https://esm.sh/react@18';
export function SelfTestCard({ loading, data, onRun }) {
  return React.createElement(
    'div',
    { className: 'card bg-base-100 shadow p-4' },
    React.createElement('h2', { className: 'card-title' }, 'Self-Test'),
    React.createElement('p', null, data ? JSON.stringify(data) : 'Run self-test to verify events and metrics.'),
    React.createElement(
      'button',
      { className: 'btn mt-2', onClick: onRun, disabled: loading },
      loading ? 'Running…' : 'Run self-test',
    ),
  );
}
