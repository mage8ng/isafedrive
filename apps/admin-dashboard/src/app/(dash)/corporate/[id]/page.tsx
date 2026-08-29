'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { ErrorBox, Money, PageHeader, Table, Badge } from '@/lib/components';

interface Account {
  id: string;
  name: string;
  balance: number;
  active: boolean;
  adminUser?: { fullName?: string; phone?: string };
}

interface Employee extends Record<string, unknown> {
  id: string;
  active: boolean;
  perRideLimit: number | null;
  monthlyLimit: number | null;
  department: string | null;
  user?: { fullName?: string; phone?: string };
}

interface Invoice {
  period: string;
  trips: number;
  total: number;
  byEmployee: { phone: string; trips: number; total: number }[];
}

export default function CorporateDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<{ account: Account; employees: Employee[] } | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api(`/admin/corporate/${params.id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    await api(`/admin/corporate/${params.id}/employees`, {
      method: 'POST',
      body: JSON.stringify({
        phone: fd.get('phone'),
        perRideLimit: fd.get('perRideLimit') ? Number(fd.get('perRideLimit')) : undefined,
        monthlyLimit: fd.get('monthlyLimit') ? Number(fd.get('monthlyLimit')) : undefined,
        department: fd.get('department') || undefined,
      }),
    });
    form.reset();
    load();
  }

  async function loadInvoice() {
    const now = new Date();
    setInvoice(
      await api<Invoice>(
        `/admin/corporate/${params.id}/invoice?year=${now.getFullYear()}&month=${now.getMonth() + 1}`,
      ),
    );
  }

  if (error) return <ErrorBox message={error} />;
  if (!data) return <p>Loading...</p>;

  return (
    <>
      <PageHeader
        title={data.account.name}
        subtitle={`Corporate account - balance ₦${Number(data.account.balance).toLocaleString()}`}
        actions={
          <>
            <button
              onClick={async () => {
                const amount = Number(prompt('Top-up amount (NGN):'));
                if (!amount) return;
                await api(`/admin/corporate/${params.id}/topup`, {
                  method: 'POST',
                  body: JSON.stringify({ amount }),
                });
                load();
              }}
            >
              Top up
            </button>
            <button onClick={loadInvoice}>Generate this month&apos;s invoice</button>
          </>
        }
      />
      <ErrorBox message={error} />

      <h3 className="section">Employees</h3>
      <form className="card inline-form" onSubmit={addEmployee}>
        <input name="phone" placeholder="Employee phone" required />
        <input name="perRideLimit" type="number" placeholder="Per-ride limit" />
        <input name="monthlyLimit" type="number" placeholder="Monthly limit" />
        <input name="department" placeholder="Department / cost center" />
        <button className="primary" type="submit">
          Add employee
        </button>
      </form>
      <Table<Employee>
        rowKey={(r) => r.id}
        columns={[
          { key: 'name', label: 'Employee', render: (r) => r.user?.fullName ?? '-' },
          { key: 'phone', label: 'Phone', render: (r) => r.user?.phone ?? '-' },
          { key: 'dept', label: 'Department', render: (r) => r.department ?? '-' },
          { key: 'ride', label: 'Per-ride limit', render: (r) => (r.perRideLimit ? <Money value={r.perRideLimit} /> : 'unlimited') },
          { key: 'month', label: 'Monthly limit', render: (r) => (r.monthlyLimit ? <Money value={r.monthlyLimit} /> : 'unlimited') },
          { key: 'active', label: 'Active', render: (r) => <Badge>{String(r.active)}</Badge> },
        ]}
        rows={data.employees}
        empty="No employees added."
      />

      {invoice && (
        <>
          <h3 className="section">
            Invoice {invoice.period} - {invoice.trips} trips, ₦{invoice.total.toLocaleString()}
          </h3>
          <Table
            rowKey={(r) => r.phone}
            columns={[
              { key: 'phone', label: 'Employee' },
              { key: 'trips', label: 'Trips' },
              { key: 'total', label: 'Total', render: (r) => <Money value={r.total} /> },
            ]}
            rows={invoice.byEmployee}
            empty="No completed business trips this month."
          />
        </>
      )}
    </>
  );
}
