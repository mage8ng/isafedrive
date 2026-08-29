'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { ErrorBox, PageHeader } from '@/lib/components';

interface Setup {
  secret: string;
  otpauthUrl: string;
}

export default function SecurityPage() {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function start() {
    setError('');
    setMessage('');
    setSetup(await api<Setup>('/admin/2fa/setup', { method: 'POST' }));
  }

  async function enable() {
    setError('');
    try {
      await api('/admin/2fa/enable', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      setMessage('2FA enabled - you will need your authenticator app at next sign-in.');
      setSetup(null);
      setToken('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function disable() {
    setError('');
    try {
      await api('/admin/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      setMessage('2FA disabled.');
      setToken('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }

  return (
    <>
      <PageHeader
        title="Security - 2FA"
        subtitle="Time-based one-time passwords (TOTP) for admin sign-in - works with Google Authenticator, Authy, 1Password"
      />
      <ErrorBox message={error} />
      {message && <p style={{ color: 'var(--accent)', marginBottom: 12 }}>{message}</p>}

      {!setup && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="primary" onClick={start}>
            Set up 2FA
          </button>
        </div>
      )}

      {setup && (
        <div className="card" style={{ maxWidth: 520, display: 'grid', gap: 12 }}>
          <div>
            <div className="stat-label">1. Add this secret key to your authenticator app (manual entry):</div>
            <code style={{ fontSize: 18, letterSpacing: 2, wordBreak: 'break-all' }}>{setup.secret}</code>
          </div>
          <div>
            <div className="stat-label">Or paste this URI into a compatible app:</div>
            <code style={{ fontSize: 11, wordBreak: 'break-all' }}>{setup.otpauthUrl}</code>
          </div>
          <div>
            <div className="stat-label">2. Enter the current 6-digit code to confirm:</div>
            <input
              placeholder="123456"
              maxLength={6}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              style={{ maxWidth: 160, textAlign: 'center', fontSize: 18, letterSpacing: 6 }}
            />
          </div>
          <button className="primary" onClick={enable} disabled={token.length !== 6}>
            Enable 2FA
          </button>
        </div>
      )}

      <h3 className="section">Disable 2FA</h3>
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          placeholder="Current 6-digit code"
          maxLength={6}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          style={{ maxWidth: 200 }}
        />
        <button className="danger" onClick={disable} disabled={token.length !== 6}>
          Disable
        </button>
      </div>
    </>
  );
}
