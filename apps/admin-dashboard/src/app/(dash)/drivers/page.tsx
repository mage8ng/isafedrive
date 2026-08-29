'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ErrorBox, PageHeader, Table, Badge } from '@/lib/components';

interface DriverRow extends Record<string, unknown> {
  id: string;
  user?: { id?: string; fullName?: string; phone?: string };
  kycStatus: string;
  onlineStatus: string;
  licenseNumber: string | null;
  rating: string;
  acceptanceRate: string;
  createdAt: string;
}

const TABS = [
  { key: 'all', label: 'All drivers' },
  { key: 'pending', label: 'Pending approval' },
  { key: 'suspended', label: 'Suspended' },
];

export default function DriversPage() {
  const [tab, setTab] = useState('all');
  const [rows, setRows] = useState<DriverRow[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const all = await api<DriverRow[]>('/admin/drivers');
      setRows(
        tab === 'pending'
          ? all.filter((d) => d.kycStatus === 'under_review')
          : tab === 'suspended'
            ? all.filter((d) => d.kycStatus === 'suspended')
            : all,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function kyc(id: string, decision: 'approved' | 'rejected') {
    await api(`/admin/kyc/${id}`, { method: 'PUT', body: JSON.stringify({ decision }) });
    load();
  }

  async function driverStatus(id: string, action: 'suspend' | 'reactivate') {
    await api(`/admin/drivers/${id}/status`, { method: 'PUT', body: JSON.stringify({ action }) });
    load();
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Permanently delete driver ${name || ''}? This removes their account, vehicle and trips.`)) return;
    try {
      await api(`/admin/drivers/${id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <>
      <PageHeader title="Drivers" subtitle="Approvals, documents and account status" />
      <ErrorBox message={error} />
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <Table<DriverRow>
        rowKey={(r) => r.id}
        columns={[
          { key: 'name', label: 'Driver', render: (r) => r.user?.fullName ?? '-' },
          { key: 'phone', label: 'Phone', render: (r) => r.user?.phone ?? '-' },
          { key: 'kyc', label: 'KYC', render: (r) => <Badge>{r.kycStatus}</Badge> },
          { key: 'online', label: 'Online', render: (r) => r.onlineStatus },
          { key: 'license', label: 'Licence', render: (r) => r.licenseNumber ?? '-' },
          { key: 'rating', label: 'Rating', render: (r) => `${r.rating} ★` },
          { key: 'accept', label: 'Acceptance', render: (r) => `${r.acceptanceRate}%` },
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <span style={{ display: 'flex', gap: 6 }}>
                {r.kycStatus === 'under_review' && (
                  <>
                    <button onClick={() => kyc(r.id, 'approved')}>Approve</button>
                    <button className="danger" onClick={() => kyc(r.id, 'rejected')}>
                      Reject
                    </button>
                  </>
                )}
                {r.kycStatus === 'approved' && (
                  <button className="danger" onClick={() => driverStatus(r.id, 'suspend')}>
                    Suspend
                  </button>
                )}
                {r.kycStatus === 'suspended' && (
                  <button onClick={() => driverStatus(r.id, 'reactivate')}>Reactivate</button>
                )}
                <button className="danger" onClick={() => remove(r.id, r.user?.fullName ?? '')}>
                  Delete
                </button>
              </span>
            ),
          },
        ]}
        rows={rows}
        empty="No drivers in this view."
      />
    </>
  );
}
