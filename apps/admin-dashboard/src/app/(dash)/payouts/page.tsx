'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ErrorBox, Money, PageHeader, Table, Badge } from '@/lib/components';

interface PayoutRow extends Record<string, unknown> {
  id: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: string;
  reference: string;
  createdAt: string;
  processedAt: string | null;
}

export default function PayoutsPage() {
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    phone: '',
    amount: 0,
    bankName: '',
    accountNumber: '',
    accountName: '',
  });

  const load = useCallback(async () => {
    try {
      setRows(await api<PayoutRow[]>('/admin/withdrawals'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id: string, status: 'paid' | 'rejected') {
    await api(`/admin/withdrawals/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    load();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/admin/withdrawals', {
        method: 'POST',
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      setForm({ phone: '', amount: 0, bankName: '', accountNumber: '', accountName: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <>
      <PageHeader
        title="Driver payouts"
        subtitle="Settlement queue - create payout requests and mark them paid or rejected"
      />
      <ErrorBox message={error} />

      <form onSubmit={create} className="card inline-form">
        <input
          placeholder="Driver phone (+234...)"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          required
        />
        <input
          type="number"
          placeholder="Amount (₦)"
          value={form.amount || ''}
          onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
          required
        />
        <input
          placeholder="Bank name"
          value={form.bankName}
          onChange={(e) => setForm({ ...form, bankName: e.target.value })}
          required
        />
        <input
          placeholder="Account number"
          value={form.accountNumber}
          onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
          required
        />
        <input
          placeholder="Account name"
          value={form.accountName}
          onChange={(e) => setForm({ ...form, accountName: e.target.value })}
          required
        />
        <button type="submit" className="primary" disabled={!form.phone || !form.amount || !form.bankName}>
          Create payout
        </button>
      </form>

      <Table<PayoutRow>
        rowKey={(r) => r.id}
        columns={[
          { key: 'amount', label: 'Amount', render: (r) => <Money value={r.amount} /> },
          { key: 'bank', label: 'Bank', render: (r) => `${r.bankName} · ${r.accountNumber}` },
          { key: 'name', label: 'Account name' },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'when', label: 'Requested', render: (r) => new Date(r.createdAt).toLocaleString() },
          { key: 'processed', label: 'Processed', render: (r) => (r.processedAt ? new Date(r.processedAt).toLocaleString() : '-') },
          {
            key: 'actions',
            label: '',
            render: (r) =>
              r.status === 'pending' ? (
                <span style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => decide(r.id, 'paid')}>Mark paid</button>
                  <button className="danger" onClick={() => decide(r.id, 'rejected')}>
                    Reject
                  </button>
                </span>
              ) : null,
          },
        ]}
        rows={rows}
        empty="No payout requests - create one above."
      />
    </>
  );
}
