const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export interface Session {
  accessToken: string;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('isafedrive_admin_token');
}

export async function adminLogin(
  username: string,
  password: string,
  token?: string,
): Promise<{ accessToken?: string; twoFaRequired?: boolean }> {
  const res = await fetch(`${API_URL}/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, token }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (data?.message === 'Valid 2FA code required') {
      return { twoFaRequired: true };
    }
    throw new Error(data?.message ?? 'Login failed');
  }
  window.localStorage.setItem('isafedrive_admin_token', data.accessToken as string);
  return { accessToken: data.accessToken as string };
}

export async function verifyOtp(
  phone: string,
  code: string,
): Promise<{ accessToken?: string; twoFaRequired?: boolean }> {
  const res = await fetch(`${API_URL}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });
  const data = await res.json();
  if (data.twoFaRequired) {
    return { twoFaRequired: true };
  }
  if (data.user?.role !== 'admin') {
    throw new Error(
      'This account is not an admin yet - ask a super admin to add it on the Admin Users page',
    );
  }
  const token = data.accessToken as string;
  window.localStorage.setItem('isafedrive_admin_token', token);
  return { accessToken: token };
}

export async function verify2fa(phone: string, code: string) {
  const res = await fetch(`${API_URL}/auth/verify-2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, token: code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message ?? 'Invalid 2FA code');
  window.localStorage.setItem('isafedrive_admin_token', data.accessToken as string);
  return data.accessToken as string;
}

export async function downloadCsv(path: string, filename: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (res.status === 401 && typeof window !== 'undefined') {
    window.localStorage.removeItem('isafedrive_admin_token');
    window.location.href = '/login';
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message ?? `Request failed (${res.status})`);
  return data as T;
}
