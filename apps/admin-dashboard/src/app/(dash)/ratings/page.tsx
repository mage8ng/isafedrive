'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ErrorBox, PageHeader, Table, Badge } from '@/lib/components';

interface RatingRow extends Record<string, unknown> {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  fromUser?: { fullName?: string; phone?: string };
  toUser?: { fullName?: string; phone?: string };
}

export default function RatingsPage() {
  const [rows, setRows] = useState<RatingRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<RatingRow[]>('/admin/ratings').then(setRows).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <PageHeader title="Ratings & reviews" subtitle="Two-way ratings across all completed trips" />
      <ErrorBox message={error} />
      <Table<RatingRow>
        rowKey={(r) => r.id}
        columns={[
          {
            key: 'stars',
            label: 'Rating',
            render: (r) => <Badge>{'★'.repeat(r.rating) + '☆'.repeat(5 - r.rating)}</Badge>,
          },
          { key: 'from', label: 'From', render: (r) => r.fromUser?.phone ?? '-' },
          { key: 'to', label: 'To', render: (r) => r.toUser?.phone ?? '-' },
          { key: 'comment', label: 'Comment', render: (r) => r.comment ?? '-' },
          { key: 'when', label: 'Date', render: (r) => new Date(r.createdAt).toLocaleString() },
        ]}
        rows={rows}
        empty="No ratings yet."
      />
    </>
  );
}
