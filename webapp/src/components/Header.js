import React from 'https://esm.sh/react@18';

export function Header({ onRefresh, disabled }) {
  return React.createElement(
    'div',
    { className: 'max-w-lg mx-auto px-4 mt-4 mb-2' },
    React.createElement(
      'div',
      { className: 'flex items-start justify-between' },
      React.createElement(
        'div',
        null,
        React.createElement('div', { className: 'text-xl font-semibold' }, 'Dora Pulse Setup'),
        React.createElement(
          'div',
          { className: 'text-sm text-base-content/60' },
          'Connect GitHub, verify events, set production environments',
        ),
      ),
      React.createElement(
        'button',
        {
          className:
            'btn btn-sm rounded-full bg-[#2AABEE] hover:bg-[#229ED9] border-none text-white disabled:opacity-50',
          onClick: onRefresh,
          disabled,
        },
        'Refresh',
      ),
    ),
  );
}


