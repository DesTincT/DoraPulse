export function InlineMessage({ type = 'info', children }) {
  const cls =
    type === 'success' ? 'text-[13px] tg-success' : type === 'error' ? 'text-[13px] tg-error' : 'text-[13px] tg-hint';
  return <div className={cls}>{children}</div>;
}
