export function ListRow({ title, subtitle, right, children, last = false }) {
  const borderClass = last ? '' : 'border-b border-base-200/60';
  const childrenPad = last ? '' : 'pb-4';

  return (
    <div className={borderClass}>
      <div className="flex items-center justify-between py-4">
        <div className="min-w-0 pr-4">
          <div className="font-semibold truncate">{title}</div>
          {subtitle ? <div className="text-sm text-base-content/60 truncate">{subtitle}</div> : null}
        </div>
        {right ? <div className="flex items-center gap-2 shrink-0">{right}</div> : null}
      </div>
      {children ? <div className={childrenPad}>{children}</div> : null}
    </div>
  );
}

