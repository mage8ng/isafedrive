'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ErrorBox, PageHeader, Table, Badge } from '@/lib/components';

interface AuditRow extends Record<string, unknown> {
  id: string;
  adminName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export default function AuditLogsPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<AuditRow[]>('/admin/audit-logs').then(setRows).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <PageHeader title="Audit logs" subtitle="Every sensitive admin action, permanently recorded" />
      <ErrorBox message={error} />
      <Table<AuditRow>
        rowKey={(r) => r.id}
        columns={[
          { key: 'admin', label: 'Admin', render: (r) => r.adminName ?? '-' },
          { key: 'action', label: 'Action', render: (r) => <Badge>{r.action}</Badge> },
          { key: 'target', label: 'Target', render: (r) => `${r.targetType ?? '-'} ${r.targetId?.slice(0, 8) ?? ''}` },
          {
            key: 'details',
            label: 'Details',
            render: (r) => (r.details ? JSON.stringify(r.details) : '-'),
          },
          { key: 'ip', label: 'IP', render: (r) => r.ipAddress ?? '-' },
          { key: 'when', label: 'Timestamp', render: (r) => new Date(r.createdAt).toLocaleString() },
        ]}
        rows={rows}
        empty="No audit entries yet."
      />
    </>
  );
}
