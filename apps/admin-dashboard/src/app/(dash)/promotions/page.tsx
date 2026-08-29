'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ErrorBox, Money, PageHeader, Table, Badge } from '@/lib/components';

interface PromoRow extends Record<string, unknown> {
  id: string;
  code: string;
  type: string;
  value: number;
  minimumRideAmount: number;
  maximumDiscount: number;
  usageLimit: number;
  usedCount: number;
  expiresAt: string | null;
  status: string;
}

export default function PromotionsPage() {
  const [rows, setRows] = useState<PromoRow[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    code: '',
    type: 'percentage',
    value: 10,
    maximumDiscount: 5000,
    usageLimit: 100,
    expiresAt: '',
  });

  const load = useCallback(async () => {
    try {
      setRows(await api<PromoRow[]>('/admin/promotions'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/admin/promotions', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          value: Number(form.value),
          maximumDiscount: Number(form.maximumDiscount),
          usageLimit: Number(form.usageLimit),
          expiresAt: form.expiresAt || undefined,
        }),
      });
      setForm({ code: '', type: 'percentage', value: 10, maximumDiscount: 5000, usageLimit: 100, expiresAt: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create promotion');
    }
  }

  return (
    <>
      <PageHeader title="Promotions" subtitle="Coupons, discounts and campaigns" />
      <ErrorBox message={error} />

      <form onSubmit={create} className="card inline-form">
        <input
          placeholder="CODE"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          required
        />
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
        >
          <option value="percentage">percentage</option>
          <option value="fixed_amount">fixed amount</option>
          <option value="first_ride">first ride</option>
          <option value="referral">referral</option>
        </select>
        <input
          type="number"
          placeholder="Value"
          title="Percent or fixed NGN amount"
          value={form.value}
          onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
          required
        />
        <input
          type="number"
          placeholder="Max discount"
          title="Maximum discount (₦)"
          value={form.maximumDiscount}
          onChange={(e) => setForm({ ...form, maximumDiscount: Number(e.target.value) })}
        />
        <input
          type="number"
          placeholder="Usage limit"
          title="Total usage limit"
          value={form.usageLimit}
          onChange={(e) => setForm({ ...form, usageLimit: Number(e.target.value) })}
        />
        <input
          type="date"
          title="Expiry date (optional)"
          value={form.expiresAt}
          onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
        />
        <button type="submit" className="primary" disabled={!form.code}>
          Create promo
        </button>
      </form>

      <Table<PromoRow>
        rowKey={(r) => r.id}
        columns={[
          { key: 'code', label: 'Code', render: (r) => <b>{r.code}</b> },
          { key: 'type', label: 'Type', render: (r) => <Badge>{r.type.replaceAll('_', ' ')}</Badge> },
          {
            key: 'value',
            label: 'Value',
            render: (r) => (r.type === 'percentage' ? `${r.value}%` : <Money value={r.value} />),
          },
          {
            key: 'usage',
            label: 'Usage',
            render: (r) => `${r.usedCount} / ${r.usageLimit}`,
          },
          {
            key: 'expires',
            label: 'Expires',
            render: (r) => (r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : 'never'),
          },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          {
            key: 'actions',
            label: '',
            render: (r) =>
              r.status === 'active' ? (
                <button
                  className="danger"
                  onClick={async () => {
                    await api(`/admin/promotions/${r.id}/disable`, { method: 'PUT' });
                    load();
                  }}
                >
                  Disable
                </button>
              ) : null,
          },
        ]}
        rows={rows}
        empty="No promotions yet."
      />
    </>
  );
}
