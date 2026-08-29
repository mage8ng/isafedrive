'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ErrorBox, Money, PageHeader, Table, Badge } from '@/lib/components';

interface FleetRow extends Record<string, unknown> {
  id: string;
  name: string;
  commissionPercent: string;
  active: boolean;
  owner?: { fullName?: string; phone?: string };
}

export default function FleetsPage() {
  const [rows, setRows] = useState<FleetRow[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', ownerPhone: '', commissionPercent: 10 });

  const load = useCallback(async () => {
    try {
      setRows(await api<FleetRow[]>('/admin/fleets'));
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
        title="Fleet management"
        subtitle="Fleet owners, drivers, commission splits and performance"
      />
      <ErrorBox message={error} />
      <form
        className="card inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          await api('/admin/fleets', { method: 'POST', body: JSON.stringify(form) });
          setForm({ name: '', ownerPhone: '', commissionPercent: 10 });
          load();
        }}
      >
        <input
          placeholder="Fleet name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          placeholder="Owner phone"
          value={form.ownerPhone}
          onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })}
          required
        />
        <input
          type="number"
          placeholder="Commission %"
          value={form.commissionPercent}
          onChange={(e) => setForm({ ...form, commissionPercent: Number(e.target.value) })}
          style={{ width: 130 }}
        />
        <button className="primary" type="submit" disabled={!form.name || !form.ownerPhone}>
          Create fleet
        </button>
      </form>
      <Table<FleetRow>
        rowKey={(r) => r.id}
        columns={[
          {
            key: 'name',
            label: 'Fleet',
            render: (r) => (
              <Link href={`/fleets/${r.id}`} style={{ color: 'var(--accent)' }}>
                {r.name}
              </Link>
            ),
          },
          { key: 'owner', label: 'Owner', render: (r) => r.owner?.phone ?? '-' },
          { key: 'commission', label: 'Commission', render: (r) => `${r.commissionPercent}%` },
          { key: 'active', label: 'Active', render: (r) => <Badge>{String(r.active)}</Badge> },
        ]}
        rows={rows}
        empty="No fleets yet."
      />
    </>
  );
}
