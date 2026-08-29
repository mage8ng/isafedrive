'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ErrorBox, PageHeader, Table, Badge } from '@/lib/components';

interface AdminRow extends Record<string, unknown> {
  id: string;
  fullName: string | null;
  phone: string;
  role: string;
  status: string;
  createdAt: string;
}

export default function AdminsPage() {
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [error, setError] = useState('');
  const [noAccess, setNoAccess] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '' });

  const load = useCallback(async () => {
    try {
      setRows(await api<AdminRow[]>('/admin/admins'));
      setNoAccess(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed';
      if (msg.includes('super_admin')) {
        setNoAccess(true);
      } else {
        setError(msg);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/admin/admins', { method: 'POST', body: JSON.stringify(form) });
      setForm({ fullName: '', phone: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  if (noAccess) {
    return (
      <>
        <PageHeader title="Admin users" />
        <div className="card" style={{ maxWidth: 480 }}>
          <b>Super admin only.</b>
          <p className="muted" style={{ marginTop: 6 }}>
            Managing admin accounts requires the super_admin role. Ask your platform owner to
            upgrade your account.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Admin users"
        subtitle="Super admins can promote accounts to admin - they sign in with phone OTP"
      />
      <ErrorBox message={error} />
      <form onSubmit={create} className="card inline-form">
        <input
          placeholder="Full name"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          required
        />
        <input
          placeholder="+234..."
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          required
        />
        <button type="submit" className="primary" disabled={!form.fullName || !form.phone}>
          Add admin
        </button>
      </form>
      <Table<AdminRow>
        rowKey={(r) => r.id}
        columns={[
          { key: 'name', label: 'Name', render: (r) => r.fullName ?? '-' },
          { key: 'phone', label: 'Phone' },
          { key: 'role', label: 'Role', render: (r) => <Badge>{r.role}</Badge> },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'when', label: 'Created', render: (r) => new Date(r.createdAt).toLocaleDateString() },
        ]}
        rows={rows}
        empty="No admins yet."
      />
    </>
  );
}
