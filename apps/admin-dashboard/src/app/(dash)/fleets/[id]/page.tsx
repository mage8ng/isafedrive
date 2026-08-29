'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { ErrorBox, Money, PageHeader, Table, Badge } from '@/lib/components';

interface Fleet {
  id: string;
  name: string;
  commissionPercent: string;
  active: boolean;
  owner?: { fullName?: string; phone?: string };
}

interface Detail {
  fleet: Fleet;
  drivers: { id: string; active: boolean; driverUser?: { fullName?: string; phone?: string } }[];
  vehicles: { id: string; make: string; model: string; plateNumber: string; status: string }[];
  performance: {
    completedTrips: number;
    grossEarnings: number;
    fleetCommission: number;
    driverPayouts: number;
  };
}

export default function FleetDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api<Detail>(`/admin/fleets/${params.id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <p>Loading...</p>;

  return (
    <>
      <PageHeader
        title={data.fleet.name}
        subtitle={`Fleet commission ${data.fleet.commissionPercent}% - owner ${data.fleet.owner?.phone ?? '-'}`}
      />
      <ErrorBox message={error} />

      <h3 className="section">Performance</h3>
      <div className="grid">
        <div className="card">
          <div className="stat-value">{data.performance.completedTrips}</div>
          <div className="stat-label">Completed trips</div>
        </div>
        <div className="card">
          <div className="stat-value"><Money value={data.performance.grossEarnings} /></div>
          <div className="stat-label">Gross driver earnings</div>
        </div>
        <div className="card">
          <div className="stat-value"><Money value={data.performance.fleetCommission} /></div>
          <div className="stat-label">Fleet commission</div>
        </div>
        <div className="card">
          <div className="stat-value"><Money value={data.performance.driverPayouts} /></div>
          <div className="stat-label">Driver payouts</div>
        </div>
      </div>

      <h3 className="section">Fleet drivers</h3>
      <form
        className="card inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target as HTMLFormElement);
          await api(`/admin/fleets/${params.id}/drivers`, {
            method: 'POST',
            body: JSON.stringify({ driverPhone: fd.get('phone') }),
          });
          (e.target as HTMLFormElement).reset();
          load();
        }}
      >
        <input name="phone" placeholder="Driver phone" required />
        <button className="primary" type="submit">
          Add driver
        </button>
      </form>
      <Table
        rowKey={(r) => r.id}
        columns={[
          { key: 'name', label: 'Driver', render: (r) => r.driverUser?.fullName ?? '-' },
          { key: 'phone', label: 'Phone', render: (r) => r.driverUser?.phone ?? '-' },
          { key: 'active', label: 'Active', render: (r) => <Badge>{String(r.active)}</Badge> },
          {
            key: 'actions',
            label: '',
            render: (r) =>
              r.active ? (
                <button
                  className="danger"
                  onClick={async () => {
                    await api(`/admin/fleets/${params.id}/drivers/remove`, {
                      method: 'POST',
                      body: JSON.stringify({ driverPhone: r.driverUser?.phone }),
                    });
                    load();
                  }}
                >
                  Remove
                </button>
              ) : null,
          },
        ]}
        rows={data.drivers}
        empty="No drivers in this fleet."
      />

      <h3 className="section">Fleet vehicles</h3>
      <Table
        rowKey={(r) => r.id}
        columns={[
          { key: 'vehicle', label: 'Vehicle', render: (r) => `${r.make} ${r.model}` },
          { key: 'plate', label: 'Plate' },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        ]}
        rows={data.vehicles}
        empty="No vehicles assigned to fleet drivers."
      />
    </>
  );
}
