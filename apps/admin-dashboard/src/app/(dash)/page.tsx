'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ErrorBox, Money, PageHeader, StatCard as SC } from '@/lib/components';

interface Dash {
  users: { total: number; passengers: number; newToday: number };
  drivers: { total: number; online: number; offline: number; suspended: number; pendingApproval: number };
  vehicles: { total: number; active: number };
  trips: {
    today: number; completed: number; cancelled: number; active: number;
    scheduled: number; cancellationRate: number; averageValue: number;
  };
  finance: {
    grossBookings: number; platformCommission: number; driverEarnings: number;
    refunds: number; walletFloat: number; byPaymentMethod: Record<string, number>;
  };
  quality: { avgDriverRating: number; avgPassengerRating: number };
  ops: { pendingWithdrawals: number; supportTickets: number; safetyIncidents: number };
}

export default function OverviewPage() {
  const [stats, setStats] = useState<Dash | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Dash>('/admin/dashboard').then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!stats) return <p>Loading...</p>;

  const pm = stats.finance.byPaymentMethod;

  return (
    <>
      <PageHeader title="Command center" subtitle="Live marketplace overview" />
      <ErrorBox message={error} />

      <h3 className="section">Customers & Drivers</h3>
      <div className="grid">
        <SC color="blue" icon="👥" label="Total users" value={stats.users.total} />
        <SC color="sky" icon="🧍" label="Passengers" value={stats.users.passengers} />
        <SC color="teal" icon="✨" label="New customers today" value={stats.users.newToday} />
        <SC color="indigo" icon="🚗" label="Total drivers" value={stats.drivers.total} />
        <SC color="green" icon="🟢" label="Drivers online" value={stats.drivers.online} hint={`${stats.drivers.offline} offline`} />
        <SC color="orange" icon="⛔" label="Suspended drivers" value={stats.drivers.suspended} />
        <SC color="amber" icon="⏳" label="Pending approvals" value={stats.drivers.pendingApproval} />
        <SC color="purple" icon="🚘" label="Vehicles (active)" value={`${stats.vehicles.total} (${stats.vehicles.active})`} />
      </div>

      <h3 className="section">Trips</h3>
      <div className="grid">
        <SC color="blue" icon="📅" label="Trips today" value={stats.trips.today} />
        <SC color="emerald" label="Active now" value={stats.trips.active} icon="🟢" />
        <SC color="green" icon="✅" label="Completed" value={stats.trips.completed} />
        <SC color="red" icon="❌" label="Cancelled" value={stats.trips.cancelled} />
        <SC color="orange" icon="📉" label="Cancellation rate" value={`${stats.trips.cancellationRate}%`} />
        <SC color="purple" icon="💰" label="Avg trip value" value={<Money value={stats.trips.averageValue} />} />
      </div>

      <h3 className="section">Finance</h3>
      <div className="grid">
        <SC color="emerald" icon="💵" label="Gross bookings" value={<Money value={stats.finance.grossBookings} />} />
        <SC color="blue" icon="🏛️" label="Platform commission (20%)" value={<Money value={stats.finance.platformCommission} />} />
        <SC color="teal" icon="🚕" label="Driver earnings (80%)" value={<Money value={stats.finance.driverEarnings} />} />
        <SC color="red" icon="↩️" label="Refunds" value={<Money value={stats.finance.refunds} />} />
        <SC color="indigo" icon="👛" label="Wallet float" value={<Money value={stats.finance.walletFloat} />} />
        <SC
          color="pink"
          icon="💳"
          label="Payment mix"
          value={<span style={{ fontSize: 15 }}>{Object.entries(pm).map(([k, v]) => `${k}: ${v}`).join(' · ') || '-'}</span>}
        />
      </div>

      <h3 className="section">Quality & Ops</h3>
      <div className="grid">
        <SC color="purple" icon="⭐" label="Avg driver rating" value={`${stats.quality.avgDriverRating} ★`} />
        <SC color="pink" icon="🌟" label="Avg passenger rating" value={`${stats.quality.avgPassengerRating} ★`} />
        <SC color="amber" icon="🏦" label="Pending payouts" value={stats.ops.pendingWithdrawals} />
        <SC color="sky" icon="🎧" label="Open support tickets" value={stats.ops.supportTickets} />
        <SC color="red" icon="🆘" label="Safety incidents" value={stats.ops.safetyIncidents} />
      </div>
    </>
  );
}
