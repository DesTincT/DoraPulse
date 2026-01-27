export function Alert({ type = 'info', children }) {
  const classes = type === 'error' ? 'alert alert-error' : type === 'success' ? 'alert alert-success' : 'alert';
  return <div className={classes}>{children}</div>;
}
