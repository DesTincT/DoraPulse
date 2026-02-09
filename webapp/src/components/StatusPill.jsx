export function StatusPill({ text, icon = null }) {
  return (
    <span className="tg-pill">
      {icon ? <span className="tg-pill-icon" aria-hidden="true">{icon}</span> : null}
      <span className="tg-pill-text">{text}</span>
    </span>
  );
}
