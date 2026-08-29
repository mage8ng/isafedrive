'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ErrorBox, Money, PageHeader, Table, Badge } from '@/lib/components';

interface Pricing {
  categories: {
    id: string;
    name: string;
    baseFare: number;
    perKm: number;
    perMinute: number;
    minimumFare: number;
    capacity: number;
  }[];
  fees: {
    bookingFee: number;
    waitingFeePerMinute: number;
    cancellationFee: number;
    airportFee: number;
  };
  commission: { driverPercentage: number; platformPercentage: number };
  surge: {
    minimumMultiplier: number;
    maximumMultiplier: number;
    rules: { supplyDemandRatio: number; multiplier: number }[];
  };
}

export default function PricingPage() {
  const [data, setData] = useState<Pricing | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Pricing>('/admin/pricing').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <p>Loading...</p>;

  return (
    <>
      <PageHeader
        title="Pricing engine"
        subtitle="Fare rules per category, fees, commission and surge ladder"
      />
      <ErrorBox message={error} />

      <h3 className="section">Fare per category (₦)</h3>
      <Table<Pricing['categories'][number]>
        rowKey={(r) => r.id}
        columns={[
          { key: 'name', label: 'Category' },
          { key: 'base', label: 'Base fare', render: (r) => <Money value={r.baseFare} /> },
          { key: 'km', label: 'Per km', render: (r) => <Money value={r.perKm} /> },
          { key: 'min', label: 'Per minute', render: (r) => <Money value={r.perMinute} /> },
          { key: 'minfare', label: 'Minimum fare', render: (r) => <Money value={r.minimumFare} /> },
          { key: 'cap', label: 'Capacity', render: (r) => `${r.capacity} seats` },
        ]}
        rows={data.categories}
      />

      <h3 className="section">Fees & commission</h3>
      <div className="grid">
        <div className="card">
          <div className="stat-value"><Money value={data.fees.bookingFee} /></div>
          <div className="stat-label">Booking fee</div>
        </div>
        <div className="card">
          <div className="stat-value"><Money value={data.fees.waitingFeePerMinute} /></div>
          <div className="stat-label">Waiting fee / min</div>
        </div>
        <div className="card">
          <div className="stat-value"><Money value={data.fees.cancellationFee} /></div>
          <div className="stat-label">Cancellation fee</div>
        </div>
        <div className="card">
          <div className="stat-value"><Money value={data.fees.airportFee} /></div>
          <div className="stat-label">Airport fee</div>
        </div>
        <div className="card">
          <div className="stat-value">{data.commission.platformPercentage}%</div>
          <div className="stat-label">Platform commission ({data.commission.driverPercentage}% driver)</div>
        </div>
      </div>

      <h3 className="section">Surge ladder</h3>
      <Table<Pricing['surge']['rules'][number]>
        rowKey={(r) => String(r.supplyDemandRatio)}
        columns={[
          { key: 'ratio', label: 'Demand ÷ supply ≥', render: (r) => `${r.supplyDemandRatio}×` },
          { key: 'mult', label: 'Multiplier', render: (r) => <Badge>{r.multiplier}×</Badge> },
        ]}
        rows={data.surge.rules}
        empty="No surge rules."
      />
    </>
  );
}
