'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <div style={{ flex: 1 }}>
        <h1>{title}</h1>
        {subtitle && <p style={{ color: 'var(--muted)', fontSize: 13 }}>{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

const CARD_GRADIENTS: Record<string, string> = {
  blue: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
  indigo: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
  green: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
  emerald: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
  amber: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
  orange: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)',
  red: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
  purple: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)',
  pink: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
  teal: 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)',
  sky: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)',
};

export function StatCard({
  label,
  value,
  hint,
  color,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  color?: keyof typeof CARD_GRADIENTS;
  icon?: string;
}) {
  if (!color) {
    return (
      <div className="card">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    );
  }
  return (
    <div
      style={{
        background: CARD_GRADIENTS[color],
        borderRadius: 14,
        padding: '16px 18px',
        color: '#fff',
        boxShadow: '0 6px 16px rgba(16, 24, 40, 0.18)',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 96,
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: -6,
          top: -10,
          fontSize: 56,
          opacity: 0.18,
          lineHeight: 1,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15 }}>{value}</div>
      <div style={{ fontSize: 12.5, opacity: 0.92, marginTop: 4, fontWeight: 600 }}>{label}</div>
      {hint && <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}

export function Money({ value }: { value: number | string | null | undefined }) {
  const n = Number(value ?? 0);
  return <>₦{n.toLocaleString('en-NG')}</>;
}

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
}

export function Table<T extends Record<string, unknown>>({
  columns,
  rows,
  empty = 'Nothing here yet.',
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
  rowKey?: (row: T) => string;
}) {
  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={{ color: 'var(--muted)' }}>
                {empty}
              </td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr key={rowKey ? rowKey(row) : i}>
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(row) : ((row[c.key] as ReactNode) ?? '-')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return <p style={{ color: '#f87171', marginBottom: 12 }}>{message}</p>;
}

export function UserLink({ id, label }: { id: string; label: string }) {
  return (
    <Link href={`/customers/${id}`} style={{ color: 'var(--accent)' }}>
      {label || id.slice(0, 8)}
    </Link>
  );
}
