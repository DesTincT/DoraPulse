import React from 'https://esm.sh/react@18';

export function ListSection({ children }) {
  return React.createElement(
    'div',
    { className: 'max-w-lg mx-auto px-4 bg-base-100 rounded-lg mt-3' },
    children,
  );
}


