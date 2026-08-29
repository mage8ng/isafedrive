'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ErrorBox, PageHeader, Table, Badge } from '@/lib/components';

interface CustomerRow extends Record<string, unknown> {
  id: string;
  fullName: string | null;
  phone: string;
  email: string | null;
  role: string;
  status: string;
  rating: string;
  createdAt: string;
}

export default function CustomersPage() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<CustomerRow[]>('/admin/customers').then(setRows).catch((e) => setError(e.message));
  }, []);

  async function setStatus(id: string, status: 'active' | 'suspended') {
    await api(`/admin/customers/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Permanently delete ${name || 'this customer'}? This wipes their trips, wallet and history.`)) return;
    try {
      await api(`/admin/customers/${id}`, { method: 'DELETE' });
      setRows((rs) => rs.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <>
      <PageHeader title="Customers" subtitle="Passengers and their account status" />
      <ErrorBox message={error} />
      <Table<CustomerRow>
        rowKey={(r) => r.id}
        columns={[
          {
            key: 'name',
            label: 'Name',
            render: (r) => (
              <Link href={`/customers/${r.id}`} style={{ color: 'var(--accent)' }}>
                {r.fullName ?? '-'}
              </Link>
            ),
          },
          { key: 'phone', label: 'Phone' },
          { key: 'email', label: 'Email', render: (r) => r.email ?? '-' },
          { key: 'role', label: 'Role' },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'rating', label: 'Rating', render: (r) => `${r.rating} ★` },
          {
            key: 'joined',
            label: 'Joined',
            render: (r) => new Date(r.createdAt).toLocaleDateString(),
          },
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <span style={{ display: 'flex', gap: 6 }}>
                {r.status === 'active' ? (
                  <button className="secondary" onClick={() => setStatus(r.id, 'suspended')}>
                    Suspend
                  </button>
                ) : (
                  <button className="secondary" onClick={() => setStatus(r.id, 'active')}>
                    Restore
                  </button>
                )}
                <button className="danger" onClick={() => remove(r.id, r.fullName ?? '')}>
                  Delete
                </button>
              </span>
            ),
          },
        ]}
        rows={rows}
        empty="No customers yet."
      />
    </>
  );
}
