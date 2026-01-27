export function InlineMessage({ type = 'info', children }) {
  const cls =
    type === 'success'
      ? 'text-sm text-green-600'
      : type === 'error'
        ? 'text-sm text-red-600'
        : 'text-sm text-base-content/70';
  return <div className={cls}>{children}</div>;
}

