'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ErrorBox, PageHeader, Table, Badge } from '@/lib/components';

interface AlertRow extends Record<string, unknown> {
  id: string;
  rule: string;
  severity: string;
  details: Record<string, unknown> | null;
  status: string;
  createdAt: string;
  user?: { id?: string; fullName?: string; phone?: string };
}

const SEV_COLOR: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#16a34a',
};

export default function FraudPage() {
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await api<AlertRow[]>('/admin/fraud/alerts'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Fraud & risk"
        subtitle="Rules engine: shared devices, impossible travel, cancellation patterns, promo abuse, short-trip collusion"
        actions={
          <button
            disabled={scanning}
            onClick={async () => {
              setScanning(true);
              try {
                await api('/admin/fraud/scan', { method: 'POST' });
                await load();
              } finally {
                setScanning(false);
              }
            }}
          >
            {scanning ? 'Scanning...' : 'Scan all users'}
          </button>
        }
      />
      <ErrorBox message={error} />
      <Table<AlertRow>
        rowKey={(r) => r.id}
        columns={[
          {
            key: 'severity',
            label: 'Severity',
            render: (r) => (
              <span style={{ color: SEV_COLOR[r.severity], fontWeight: 700 }}>
                {r.severity === 'critical' ? '🔴' : r.severity === 'high' ? '🟠' : r.severity === 'medium' ? '🟡' : '🟢'}{' '}
                {r.severity}
              </span>
            ),
          },
          { key: 'rule', label: 'Rule', render: (r) => <Badge>{r.rule}</Badge> },
          { key: 'user', label: 'User', render: (r) => r.user?.phone ?? '-' },
          {
            key: 'details',
            label: 'Evidence',
            render: (r) => (
              <code style={{ fontSize: 11 }}>{JSON.stringify(r.details)}</code>
            ),
          },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'when', label: 'Detected', render: (r) => new Date(r.createdAt).toLocaleString() },
          {
            key: 'actions',
            label: '',
            render: (r) =>
              r.status !== 'resolved' ? (
                <button
                  onClick={async () => {
                    await api(`/admin/fraud/alerts/${r.id}/resolve`, { method: 'POST' });
                    load();
                  }}
                >
                  Resolve
                </button>
              ) : null,
          },
        ]}
        rows={rows}
        empty="No fraud alerts - run a scan to check all users."
      />
    </>
  );
}
