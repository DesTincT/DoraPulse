export function Tabs({ value, onChange }) {
  const mk = (id, label) => (
    <a className={'tab ' + (value === id ? 'tab-active' : '')} onClick={() => onChange(id)}>
      {label}
    </a>
  );
  return (
    <div className="tabs tabs-boxed mb-4">
      {mk('connect', 'Connect')}
      {mk('verify', 'Verify')}
      {mk('env', 'Env')}
    </div>
  );
}
