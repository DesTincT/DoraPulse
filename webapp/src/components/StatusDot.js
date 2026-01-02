import React from 'https://esm.sh/react@18';

export function StatusDot({ ok, label }) {
  const color = ok ? 'bg-green-500' : 'bg-base-300';
  const dot = React.createElement('span', {
    className: `inline-block w-2.5 h-2.5 rounded-full ${color}`,
  });
  return React.createElement(
    'div',
    { className: 'flex items-center gap-2 text-sm text-base-content/80' },
    dot,
    React.createElement('span', null, label),
  );
}
