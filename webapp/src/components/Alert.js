export function Alert({ type = 'info', children }) {
  const classes = type === 'error' ? 'alert alert-error' : type === 'success' ? 'alert alert-success' : 'alert';
  return (
    // eslint-disable-next-line react/jsx-no-undef
    React.createElement('div', { className: classes }, children)
  );
}
