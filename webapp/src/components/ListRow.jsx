export function ListRow({ title, subtitle, right, children, last = false }) {
  const borderClass = last ? '' : 'tg-divider';
  const childrenPad = last ? '' : 'tg-row-body';

  return (
    <div className={borderClass}>
      <div className="tg-row">
        <div className="min-w-0">
          <div className="tg-row-title truncate">{title}</div>
          {subtitle ? <div className="tg-row-subtitle">{subtitle}</div> : null}
        </div>
        {right ? <div className="tg-row-right">{right}</div> : null}
      </div>
      {children ? <div className={childrenPad}>{children}</div> : null}
    </div>
  );
}
