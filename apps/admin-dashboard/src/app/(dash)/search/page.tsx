'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { ErrorBox, Money, Table, Badge } from '@/lib/components';

interface Results {
  users: { id: string; fullName: string | null; phone: string; role: string }[];
  rides: { id: string; status: string; fare: number; pickupAddress: string; destinationAddress: string }[];
  payments: { id: string; reference: string; amount: number; status: string }[];
  promotions: { id: string; code: string; type: string; status: string }[];
}

function SearchResults() {
  const params = useSearchParams();
  const q = params.get('q') ?? '';
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!q) return;
    api<Results>(`/admin/search?q=${encodeURIComponent(q)}`)
      .then(setResults)
      .catch((e) => setError(e.message));
  }, [q]);

  if (error) return <ErrorBox message={error} />;
  if (!results) return <p>Searching...</p>;

  const total =
    results.users.length + results.rides.length + results.payments.length + results.promotions.length;

  return (
    <>
      <h1 style={{ marginBottom: 16 }}>
        Results for &quot;{q}&quot; ({total})
      </h1>
      <h3 className="section">Users</h3>
      <Table<Results['users'][number]>
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
          { key: 'role', label: 'Role', render: (r) => <Badge>{r.role}</Badge> },
        ]}
        rows={results.users}
        empty="No matching users."
      />
      <h3 className="section">Rides</h3>
      <Table<Results['rides'][number]>
        rowKey={(r) => r.id}
        columns={[
          { key: 'id', label: 'ID', render: (r) => r.id.slice(0, 8) + '…' },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'route', label: 'Route', render: (r) => `${r.pickupAddress} → ${r.destinationAddress}` },
          { key: 'fare', label: 'Fare', render: (r) => <Money value={r.fare} /> },
        ]}
        rows={results.rides}
        empty="No matching rides."
      />
      <h3 className="section">Payments</h3>
      <Table<Results['payments'][number]>
        rowKey={(r) => r.id}
        columns={[
          { key: 'ref', label: 'Reference', render: (r) => r.reference.slice(0, 16) + '…' },
          { key: 'amount', label: 'Amount', render: (r) => <Money value={r.amount} /> },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        ]}
        rows={results.payments}
        empty="No matching payments."
      />
      <h3 className="section">Promotions</h3>
      <Table<Results['promotions'][number]>
        rowKey={(r) => r.id}
        columns={[
          { key: 'code', label: 'Code', render: (r) => <b>{r.code}</b> },
          { key: 'type', label: 'Type', render: (r) => <Badge>{r.type}</Badge> },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        ]}
        rows={results.promotions}
        empty="No matching promotions."
      />
    </>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <SearchResults />
    </Suspense>
  );
}
