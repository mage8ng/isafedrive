'use client';

import { useState } from 'react';
import { downloadCsv } from '@/lib/api';
import { ErrorBox, PageHeader } from '@/lib/components';

const REPORTS = [
  {
    path: '/admin/reports/trips.csv',
    file: 'isafedrive-trips.csv',
    label: 'Trips report (CSV)',
    desc: 'Latest 1000 trips with fares, routes, drivers and timestamps',
    icon: '🚕',
  },
  {
    path: '/admin/reports/payments.csv',
    file: 'isafedrive-payments.csv',
    label: 'Payments report (CSV)',
    desc: 'Latest 1000 gateway and manual payment transactions',
    icon: '💳',
  },
];

export default function ReportsPage() {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  async function download(path: string, file: string) {
    setError('');
    setStatus('');
    setBusy(path);
    try {
      await downloadCsv(path, file);
      setStatus('Downloaded ' + file);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <PageHeader title="Reports & exports" subtitle="Download raw data for accounting and analysis" />
      <ErrorBox message={error} />
      {status && <p style={{ color: 'var(--accent)', marginBottom: 12 }}>{status}</p>}
      <div className="grid">
        {REPORTS.map((r) => (
          <div className="card" key={r.path}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>{r.icon}</div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{r.label}</div>
            <div className="stat-label" style={{ marginBottom: 12 }}>{r.desc}</div>
            <button onClick={() => download(r.path, r.file)} disabled={busy === r.path}>
              {busy === r.path ? 'Preparing...' : 'Download CSV'}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
