'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ErrorBox, Money, PageHeader, Table, Badge } from '@/lib/components';

interface AccountRow extends Record<string, unknown> {
  id: string;
  name: string;
  balance: number;
  active: boolean;
  adminUser?: { fullName?: string; phone?: string };
}

export default function CorporatePage() {
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', adminPhone: '' });

  const load = useCallback(async () => {
    try {
      setRows(await api<AccountRow[]>('/admin/corporate'));
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
        title="Corporate accounts"
        subtitle="Business ride programs - corporate wallets, employee limits, monthly invoicing"
      />
      <ErrorBox message={error} />
      <form
        className="card inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          await api('/admin/corporate', { method: 'POST', body: JSON.stringify(form) });
          setForm({ name: '', adminPhone: '' });
          load();
        }}
      >
        <input
          placeholder="Company name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          placeholder="Admin phone"
          value={form.adminPhone}
          onChange={(e) => setForm({ ...form, adminPhone: e.target.value })}
          required
        />
        <button className="primary" type="submit" disabled={!form.name || !form.adminPhone}>
          Create account
        </button>
      </form>
      <Table<AccountRow>
        rowKey={(r) => r.id}
        columns={[
          {
            key: 'name',
            label: 'Company',
            render: (r) => (
              <Link href={`/corporate/${r.id}`} style={{ color: 'var(--accent)' }}>
                {r.name}
              </Link>
            ),
          },
          { key: 'admin', label: 'Admin', render: (r) => r.adminUser?.phone ?? '-' },
          { key: 'balance', label: 'Wallet balance', render: (r) => <Money value={r.balance} /> },
          { key: 'active', label: 'Active', render: (r) => <Badge>{String(r.active)}</Badge> },
        ]}
        rows={rows}
        empty="No corporate accounts yet."
      />
    </>
  );
}
