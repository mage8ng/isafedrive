'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { ErrorBox, Money, PageHeader, Table, Badge } from '@/lib/components';

interface Detail {
  user: {
    id: string;
    fullName: string | null;
    phone: string;
    email: string | null;
    role: string;
    status: string;
    rating: string;
    createdAt: string;
  };
  trips: {
    id: string;
    status: string;
    fare: number;
    pickupAddress: string;
    destinationAddress: string;
    requestedAt: string;
  }[];
  wallet: { balance: number; currency: string } | null;
  transactions: {
    id: string;
    type: string;
    amount: number;
    balanceAfter: number;
    description: string | null;
    createdAt: string;
  }[];
  ratingsGiven: { id: string; rating: number; comment: string | null }[];
  ratingsReceived: { id: string; rating: number; comment: string | null }[];
  tickets: { id: string; subject: string; status: string }[];
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api<Detail>(`/admin/customers/${params.id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function adjust() {
    const amount = Number(prompt('Amount (negative to debit):'));
    if (!amount) return;
    const reason = prompt('Reason:') ?? 'admin adjustment';
    await api('/admin/wallets/adjust', {
      method: 'POST',
      body: JSON.stringify({ userId: params.id, amount, reason }),
    });
    load();
  }

  if (error) return <ErrorBox message={error} />;
  if (!data) return <p>Loading...</p>;

  return (
    <>
      <PageHeader
        title={data.user.fullName ?? data.user.phone}
        subtitle={`${data.user.phone} · ${data.user.role} · ${data.user.status} · ${data.user.rating} ★`}
        actions={
          <>
            <button onClick={adjust}>Adjust wallet</button>
            <button
              className={data.user.status === 'active' ? 'danger' : ''}
              onClick={async () => {
                const status = data.user.status === 'active' ? 'suspended' : 'active';
                await api(`/admin/customers/${params.id}/status`, {
                  method: 'PUT',
                  body: JSON.stringify({ status }),
                });
                load();
              }}
            >
              {data.user.status === 'active' ? 'Suspend' : 'Restore'}
            </button>
          </>
        }
      />
      <ErrorBox message={error} />

      <h3 className="section">Wallet</h3>
      <div className="grid">
        <div className="card">
          <div className="stat-value">
            <Money value={data.wallet?.balance ?? 0} />
          </div>
          <div className="stat-label">Wallet balance</div>
        </div>
      </div>

      <h3 className="section">Recent trips ({data.trips.length})</h3>
      <Table
        rowKey={(r) => r.id}
        columns={[
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'route', label: 'Route', render: (r) => `${r.pickupAddress} → ${r.destinationAddress}` },
          { key: 'fare', label: 'Fare', render: (r) => <Money value={r.fare} /> },
          { key: 'when', label: 'Date', render: (r) => new Date(r.requestedAt).toLocaleString() },
        ]}
        rows={data.trips}
        empty="No trips."
      />

      <h3 className="section">Wallet ledger</h3>
      <Table
        rowKey={(r) => r.id}
        columns={[
          { key: 'type', label: 'Type', render: (r) => <Badge>{r.type}</Badge> },
          { key: 'amount', label: 'Amount', render: (r) => <Money value={r.amount} /> },
          { key: 'after', label: 'Balance after', render: (r) => <Money value={r.balanceAfter} /> },
          { key: 'desc', label: 'Description', render: (r) => r.description ?? '-' },
          { key: 'when', label: 'Date', render: (r) => new Date(r.createdAt).toLocaleString() },
        ]}
        rows={data.transactions}
        empty="No transactions."
      />

      <h3 className="section">Support tickets</h3>
      <Table
        rowKey={(r) => r.id}
        columns={[
          { key: 'subject', label: 'Subject' },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        ]}
        rows={data.tickets}
        empty="No tickets."
      />
    </>
  );
}
