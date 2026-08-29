'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ErrorBox, Money, PageHeader, Table, Badge } from '@/lib/components';

interface PaymentRow extends Record<string, unknown> {
  id: string;
  amount: number;
  currency: string;
  provider: string;
  reference: string;
  status: string;
  createdAt: string;
}

export default function PaymentsPage() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    phone: '',
    amount: 0,
    provider: 'cash',
    status: 'success',
  });

  const load = useCallback(async () => {
    try {
      setRows(await api<PaymentRow[]>('/admin/payments'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function record(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/admin/payments', {
        method: 'POST',
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      setForm({ phone: '', amount: 0, provider: 'cash', status: 'success' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <>
      <PageHeader title="Payments" subtitle="Gateway transactions across Paystack and Flutterwave - record manual payments" />
      <ErrorBox message={error} />

      <form onSubmit={record} className="card inline-form">
        <input
          placeholder="Customer phone (+234...)"
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
        <select
          value={form.provider}
          onChange={(e) => setForm({ ...form, provider: e.target.value })}
        >
          <option value="cash">cash</option>
          <option value="paystack">paystack</option>
          <option value="flutterwave">flutterwave</option>
          <option value="wallet">wallet</option>
        </select>
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="success">success</option>
          <option value="pending">pending</option>
          <option value="failed">failed</option>
        </select>
        <button type="submit" className="primary" disabled={!form.phone || !form.amount}>
          Record payment
        </button>
      </form>

      <Table<PaymentRow>
        rowKey={(r) => r.id}
        columns={[
          { key: 'ref', label: 'Reference', render: (r) => <span title={r.reference}>{r.reference.slice(0, 13)}…</span> },
          { key: 'amount', label: 'Amount', render: (r) => <Money value={r.amount} /> },
          { key: 'provider', label: 'Provider', render: (r) => <Badge>{r.provider}</Badge> },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'when', label: 'Date', render: (r) => new Date(r.createdAt).toLocaleString() },
        ]}
        rows={rows}
        empty="No payments yet - record one above."
      />
    </>
  );
}
