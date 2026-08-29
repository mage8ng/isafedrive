'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ErrorBox, PageHeader, Table, Badge } from '@/lib/components';

interface TicketRow extends Record<string, unknown> {
  id: string;
  category: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
}

const STATUSES = ['open', 'assigned', 'in_progress', 'resolved', 'closed'];

export default function SupportPage() {
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setRows(await api<TicketRow[]>('/admin/support'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(id: string, status: string) {
    await api(`/admin/support/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
    load();
  }

  return (
    <>
      <PageHeader title="Support help desk" subtitle="Ticket queue across payment, safety, trips and accounts" />
      <ErrorBox message={error} />
      <Table<TicketRow>
        rowKey={(r) => r.id}
        columns={[
          { key: 'subject', label: 'Subject' },
          { key: 'category', label: 'Category', render: (r) => <Badge>{r.category}</Badge> },
          { key: 'priority', label: 'Priority', render: (r) => <Badge>{r.priority}</Badge> },
          { key: 'desc', label: 'Description', render: (r) => <span className="muted">{r.description.slice(0, 60)}</span> },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'when', label: 'Opened', render: (r) => new Date(r.createdAt).toLocaleString() },
          {
            key: 'actions',
            label: 'Move to',
            render: (r) => (
              <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ),
          },
        ]}
        rows={rows}
        empty="No tickets."
      />
    </>
  );
}
