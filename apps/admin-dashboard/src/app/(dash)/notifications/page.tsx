'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { ErrorBox, PageHeader } from '@/lib/components';

export default function NotificationsPage() {
  const [form, setForm] = useState({ role: 'all', title: '', message: '' });
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResult('');
    try {
      const res = await api<{ sent: number }>('/admin/notifications/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          role: form.role === 'all' ? null : form.role,
          title: form.title,
          message: form.message,
        }),
      });
      setResult(`Broadcast queued for ${res.sent} users`);
      setForm({ role: form.role, title: '', message: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <>
      <PageHeader title="Notification center" subtitle="Push announcements to customers, drivers or everyone" />
      <ErrorBox message={error} />
      {result && <p style={{ color: 'var(--accent)', marginBottom: 12 }}>{result}</p>}
      <form onSubmit={send} className="card" style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
        <label>
          Audience
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="all">Everyone</option>
            <option value="passenger">All passengers</option>
            <option value="driver">All drivers</option>
          </select>
        </label>
        <label>
          Title
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Weekend promo!"
            required
          />
        </label>
        <label>
          Message
          <textarea
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder="Get 20% off rides this weekend with code WEEKEND20"
            rows={4}
            required
          />
        </label>
        <button type="submit" className="primary" disabled={!form.title || !form.message}>
          Send broadcast
        </button>
      </form>
    </>
  );
}
