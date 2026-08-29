'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminLogin } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFaToken, setTwoFaToken] = useState('');
  const [needs2fa, setNeeds2fa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function attempt(twoFa?: string) {
    setBusy(true);
    setError('');
    try {
      const result = await adminLogin(username, password, twoFa);
      if (result.twoFaRequired) {
        setNeeds2fa(true);
        setError('');
        return;
      }
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div className="card" style={{ width: 380, display: 'grid', gap: 14 }}>
        <img src="/logo.svg" alt="iSafeDrive" style={{ height: 40, width: 'auto', margin: '4px auto' }} />
        {error && <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            attempt(needs2fa ? twoFaToken : undefined);
          }}
          style={{ display: 'grid', gap: 14 }}
        >
          <input
            placeholder="Username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {needs2fa && (
            <>
              <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
                Enter the 6-digit code from your authenticator app.
              </p>
              <input
                placeholder="2FA code"
                maxLength={6}
                value={twoFaToken}
                onChange={(e) => setTwoFaToken(e.target.value)}
                style={{ textAlign: 'center', fontSize: 18, letterSpacing: 6 }}
                required
              />
            </>
          )}
          <button type="submit" disabled={busy || !username || !password}>
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
