import React from 'https://esm.sh/react@18';

export function InlineMessage({ type = 'info', children }) {
  const cls =
    type === 'success'
      ? 'text-sm text-green-600'
      : type === 'error'
        ? 'text-sm text-red-600'
        : 'text-sm text-base-content/70';
  return React.createElement('div', { className: cls }, children);
}
