import React from 'https://esm.sh/react@18';
export function Tabs({ value, onChange }) {
  const mk = (id, label) =>
    React.createElement(
      'a',
      {
        className: 'tab ' + (value === id ? 'tab-active' : ''),
        onClick: () => onChange(id),
      },
      label,
    );
  return React.createElement(
    'div',
    { className: 'tabs tabs-boxed mb-4' },
    mk('connect', 'Connect'),
    mk('verify', 'Verify'),
    mk('env', 'Env'),
  );
}
