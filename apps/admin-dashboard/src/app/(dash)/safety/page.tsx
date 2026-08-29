'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ErrorBox, PageHeader, Table, Badge } from '@/lib/components';

interface IncidentRow extends Record<string, unknown> {
  id: string;
  type: string;
  description: string | null;
  severity: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  ride?: { id: string };
  reportedBy?: { fullName?: string; phone?: string };
}

export default function SafetyPage() {
  const [rows, setRows] = useState<IncidentRow[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setRows(await api<IncidentRow[]>('/admin/safety'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function resolve(id: string) {
    await api(`/admin/safety/${id}/resolve`, { method: 'PUT' });
    load();
  }

  return (
    <>
      <PageHeader
        title="Safety center"
        subtitle="SOS alerts, incident reports and investigations"
      />
      <ErrorBox message={error} />
      <Table<IncidentRow>
        rowKey={(r) => r.id}
        columns={[
          { key: 'type', label: 'Type', render: (r) => <Badge>{r.type}</Badge> },
          {
            key: 'severity',
            label: 'Severity',
            render: (r) => (
              <Badge>{r.severity}</Badge>
            ),
          },
          { key: 'desc', label: 'Description', render: (r) => r.description ?? '-' },
          { key: 'by', label: 'Reported by', render: (r) => r.reportedBy?.phone ?? '-' },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'when', label: 'Date', render: (r) => new Date(r.createdAt).toLocaleString() },
          {
            key: 'actions',
            label: '',
            render: (r) =>
              r.status !== 'resolved' ? (
                <button onClick={() => resolve(r.id)}>Resolve</button>
              ) : null,
          },
        ]}
        rows={rows}
        empty="No incidents reported."
      />
    </>
  );
}
