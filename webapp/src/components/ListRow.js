import React from 'https://esm.sh/react@18';

export function ListRow({ title, subtitle, right, children, last = false }) {
  const row = React.createElement(
    'div',
    { className: 'flex items-center justify-between py-4' },
    React.createElement(
      'div',
      { className: 'min-w-0 pr-4' },
      React.createElement('div', { className: 'font-semibold truncate' }, title),
      subtitle ? React.createElement('div', { className: 'text-sm text-base-content/60 truncate' }, subtitle) : null,
    ),
    right ? React.createElement('div', { className: 'flex items-center gap-2 shrink-0' }, right) : null,
  );
  const borderClass = last ? '' : 'border-b border-base-200/60';
  const childrenPad = last ? '' : 'pb-4';
  return React.createElement(
    'div',
    { className: borderClass },
    row,
    children ? React.createElement('div', { className: childrenPad }, children) : null,
  );
}
