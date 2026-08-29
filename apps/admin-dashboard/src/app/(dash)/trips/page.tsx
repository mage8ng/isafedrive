'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ErrorBox, Money, PageHeader, Table, Badge } from '@/lib/components';

interface RideRow extends Record<string, unknown> {
  id: string;
  status: string;
  fare: number;
  paymentMethod: string;
  pickupAddress: string;
  destinationAddress: string;
  requestedAt: string;
  passenger?: { fullName?: string; phone?: string };
  driver?: { fullName?: string; phone?: string } | null;
  cancelledBy?: string | null;
  cancelReason?: string | null;
}

const TABS = ['all', 'active', 'searching', 'completed', 'cancelled', 'disputed'];

export default function TripsPage() {
  const [tab, setTab] = useState('all');
  const [rides, setRides] = useState<RideRow[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async (status: string) => {
    try {
      const qs = status === 'all' ? '' : `?status=${status}`;
      setRides(await api<RideRow[]>(`/admin/rides${qs}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  async function cancelRide(id: string) {
    const reason = prompt('Cancellation reason:');
    if (!reason) return;
    await api(`/admin/rides/${id}/cancel`, { method: 'PUT', body: JSON.stringify({ reason }) });
    load(tab);
  }

  return (
    <>
      <PageHeader title="Trips" subtitle="Monitor and manage every trip on the platform" />
      <ErrorBox message={error} />
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <Table<RideRow>
        rowKey={(r) => r.id}
        columns={[
          {
            key: 'id',
            label: 'Ride',
            render: (r) => <span title={r.id}>{r.id.slice(0, 8)}…</span>,
          },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status.replaceAll('_', ' ')}</Badge> },
          { key: 'passenger', label: 'Passenger', render: (r) => r.passenger?.phone ?? '-' },
          { key: 'driver', label: 'Driver', render: (r) => r.driver?.phone ?? '-' },
          { key: 'route', label: 'Route', render: (r) => `${r.pickupAddress} → ${r.destinationAddress}` },
          { key: 'fare', label: 'Fare', render: (r) => <Money value={r.fare} /> },
          { key: 'pm', label: 'Payment', render: (r) => r.paymentMethod },
          {
            key: 'when',
            label: 'Requested',
            render: (r) => new Date(r.requestedAt).toLocaleString(),
          },
          {
            key: 'actions',
            label: '',
            render: (r) =>
              ['requested', 'searching', 'driver_assigned', 'driver_arrived', 'in_progress'].includes(
                r.status,
              ) ? (
                <button className="danger" onClick={() => cancelRide(r.id)}>
                  Cancel
                </button>
              ) : r.cancelReason ? (
                <span className="muted" style={{ fontSize: 11 }}>
                  {r.cancelledBy}: {r.cancelReason}
                </span>
              ) : null,
          },
        ]}
        rows={rides}
        empty="No trips in this state."
      />
    </>
  );
}
