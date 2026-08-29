'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ErrorBox, Money, PageHeader, Table, Badge } from '@/lib/components';

interface WalletRow extends Record<string, unknown> {
  id: string;
  balance: number;
  currency: string;
  user?: { id?: string; fullName?: string; phone?: string; role?: string };
  updatedAt: string;
}

interface TxRow extends Record<string, unknown> {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
  wallet?: { user?: { fullName?: string; phone?: string } };
}

export default function WalletsPage() {
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [w, t] = await Promise.all([
        api<WalletRow[]>('/admin/wallets'),
        api<TxRow[]>('/admin/transactions'),
      ]);
      setWallets(w);
      setTxs(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function adjust(userId: string | undefined) {
    if (!userId) return;
    const amount = Number(prompt('Amount in NGN (negative to debit):'));
    if (!amount) return;
    const reason = prompt('Reason:') ?? 'admin adjustment';
    await api('/admin/wallets/adjust', {
      method: 'POST',
      body: JSON.stringify({ userId, amount, reason }),
    });
    load();
  }

  return (
    <>
      <PageHeader title="Wallets" subtitle="Customer and driver balances, manual adjustments (audited)" />
      <ErrorBox message={error} />

      <h3 className="section">Balances</h3>
      <Table<WalletRow>
        rowKey={(r) => r.id}
        columns={[
          { key: 'who', label: 'Owner', render: (r) => r.user?.fullName ?? r.user?.phone ?? '-' },
          { key: 'role', label: 'Role', render: (r) => r.user?.role ?? '-' },
          { key: 'balance', label: 'Balance', render: (r) => <Money value={r.balance} /> },
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <button onClick={() => adjust(r.user?.id)}>Adjust</button>
            ),
          },
        ]}
        rows={wallets}
        empty="No wallets yet."
      />

      <h3 className="section">Ledger (latest 200)</h3>
      <Table<TxRow>
        rowKey={(r) => r.id}
        columns={[
          { key: 'who', label: 'Owner', render: (r) => r.wallet?.user?.phone ?? '-' },
          { key: 'type', label: 'Type', render: (r) => <Badge>{r.type}</Badge> },
          { key: 'amount', label: 'Amount', render: (r) => <Money value={r.amount} /> },
          { key: 'after', label: 'Balance after', render: (r) => <Money value={r.balanceAfter} /> },
          { key: 'desc', label: 'Description', render: (r) => r.description ?? '-' },
          { key: 'when', label: 'Date', render: (r) => new Date(r.createdAt).toLocaleString() },
        ]}
        rows={txs}
        empty="No transactions yet."
      />
    </>
  );
}
