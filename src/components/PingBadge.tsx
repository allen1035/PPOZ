export default function PingBadge({ ping }: { ping: number | null }) {
  const txt = ping == null ? '—' : `${ping} ms`;
  const color =
    ping == null ? 'var(--muted)' : ping < 80 ? 'var(--ok)' : ping < 200 ? 'var(--accent)' : 'var(--danger)';
  return <span className="ping" style={{ color }}>延迟 {txt}</span>;
}
