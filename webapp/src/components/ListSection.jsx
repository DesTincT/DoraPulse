export function ListSection({ children }) {
  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body p-4">{children}</div>
    </div>
  );
}
