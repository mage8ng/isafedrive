'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ErrorBox, Money, PageHeader, Table, Badge } from '@/lib/components';

interface DeliveryRow extends Record<string, unknown> {
  id: string;
  recipientName: string;
  recipientPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  packageName: string;
  size: string;
  fee: number;
  status: string;
  createdAt: string;
}

export default function DeliveriesPage() {
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setRows(await api<DeliveryRow[]>('/deliveries'));
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
        title="Deliveries"
        subtitle="Package deliveries with OTP proof of delivery"
      />
      <ErrorBox message={error} />
      <Table<DeliveryRow>
        rowKey={(r) => r.id}
        columns={[
          { key: 'id', label: 'ID', render: (r) => r.id.slice(0, 8) + '…' },
          { key: 'recipient', label: 'Recipient', render: (r) => `${r.recipientName} (${r.recipientPhone})` },
          { key: 'package', label: 'Package', render: (r) => `${r.packageName} [${r.size}]` },
          { key: 'route', label: 'Route', render: (r) => `${r.pickupAddress} → ${r.dropoffAddress}` },
          { key: 'fee', label: 'Fee', render: (r) => <Money value={r.fee} /> },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status.replaceAll('_', ' ')}</Badge> },
          { key: 'when', label: 'Created', render: (r) => new Date(r.createdAt).toLocaleString() },
        ]}
        rows={rows}
        empty="No deliveries yet - passengers can book them from the rider app."
      />
    </>
  );
}
