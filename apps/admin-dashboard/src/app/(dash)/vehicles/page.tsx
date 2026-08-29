'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ErrorBox, PageHeader, Table, Badge } from '@/lib/components';

interface VehicleRow extends Record<string, unknown> {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  plateNumber: string;
  categoryId: string;
  insuranceExpiry: string | null;
  roadworthinessExpiry: string | null;
  status: string;
}

export default function VehiclesPage() {
  const [rows, setRows] = useState<VehicleRow[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setRows(await api<VehicleRow[]>('/admin/vehicles'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader title="Vehicles" subtitle="Registered vehicles, documents and approval state" />
      <ErrorBox message={error} />
      <Table<VehicleRow>
        rowKey={(r) => r.id}
        columns={[
          { key: 'vehicle', label: 'Vehicle', render: (r) => `${r.make} ${r.model} (${r.year})` },
          { key: 'color', label: 'Colour' },
          { key: 'plate', label: 'Plate' },
          { key: 'cat', label: 'Category', render: (r) => <Badge>{r.categoryId}</Badge> },
          {
            key: 'insurance',
            label: 'Insurance expiry',
            render: (r) => (r.insuranceExpiry ? new Date(r.insuranceExpiry).toLocaleDateString() : '-'),
          },
          {
            key: 'roadw',
            label: 'Roadworthiness',
            render: (r) =>
              r.roadworthinessExpiry ? new Date(r.roadworthinessExpiry).toLocaleDateString() : '-',
          },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          {
            key: 'actions',
            label: '',
            render: (r) =>
              r.status !== 'approved' ? (
                <button
                  onClick={async () => {
                    await api(`/admin/vehicles/${r.id}/approve`, { method: 'PUT' });
                    load();
                  }}
                >
                  Approve
                </button>
              ) : null,
          },
        ]}
        rows={rows}
        empty="No vehicles registered yet."
      />
    </>
  );
}
