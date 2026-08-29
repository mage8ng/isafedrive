import { readFileSync, existsSync } from 'fs';
import pg from 'pg';

const API = 'http://localhost:3000/api/v1';
const DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/isafedrive';
const LOG = 'logs/api.log';

const ADMIN_PHONE = '+2348012345678';
const DRIVER_PHONE = '+2348098765432';

function logLines() {
  return existsSync(LOG) ? readFileSync(LOG, 'utf8').split('\n') : [];
}

async function api(path, method, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 409) {
    throw new Error(`${method ?? 'GET'} ${path} -> ${res.status}: ${JSON.stringify(data)}`);
  }
  return { status: res.status, data };
}

async function loginWithOtp(phone, label = 'login') {
  const before = logLines().length;
  await api('/auth/send-otp', 'POST', { phone });

  let otp = null;
  for (let i = 0; i < 20 && !otp; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const found = logLines()
      .slice(before)
      .map((l) => l.match(new RegExp(`OTP for ${phone.replace('+', '\\+')}: (\\d{6})`)))
      .find(Boolean);
    if (found) otp = found[1];
  }
  if (!otp) throw new Error(`No OTP appeared in ${LOG} for ${phone}`);

  const { data } = await api('/auth/verify-otp', 'POST', { phone, code: otp });
  console.log(`${label}: ${phone} ok (role=${data.user.role}, otp=${otp})`);
  return data;
}

async function main() {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  const promoted = await client.query(
    "UPDATE users SET role='admin' WHERE phone=$1 RETURNING id, phone, role",
    [ADMIN_PHONE],
  );
  await client.end();
  if (promoted.rows.length === 0) throw new Error(`User ${ADMIN_PHONE} not found`);
  console.log(`promoted -> ${JSON.stringify(promoted.rows[0])}`);

  const reg = await api('/auth/register', 'POST', {
    fullName: 'Demo Driver',
    phone: DRIVER_PHONE,
    role: 'driver',
  });
  console.log(`driver ${reg.status === 409 ? 'already registered' : 'registered'}`);

  const driver = await loginWithOtp(DRIVER_PHONE, 'driver');
  await api('/drivers/kyc', 'POST', {
    governmentId: 'doc://government-id.jpg',
    driversLicense: 'doc://drivers-license.jpg',
    selfie: 'doc://selfie.jpg',
    proofOfAddress: 'doc://address.pdf',
    licenseNumber: 'DL-NG-123456',
  }, driver.accessToken);
  console.log('driver KYC submitted (pending review)');

  const pax = await loginWithOtp(ADMIN_PHONE, 'passenger');
  const ride = await api('/rides', 'POST', {
    categoryId: 'economy',
    pickupAddress: 'Ikeja City Mall',
    pickupLatitude: 6.6018,
    pickupLongitude: 3.3515,
    destinationAddress: 'Victoria Island',
    destinationLatitude: 6.4281,
    destinationLongitude: 3.4219,
    paymentMethod: 'cash',
  }, pax.accessToken);
  console.log(`ride created -> ${ride.data.id} (${ride.data.status}, fare NGN ${ride.data.fare})`);

  const admin = await loginWithOtp(ADMIN_PHONE, 'admin');
  const dash = await api('/admin/dashboard', 'GET', null, admin.accessToken);
  console.log('dashboard:', JSON.stringify(dash.data));
}

main().catch((e) => {
  console.error(`seed failed: ${e.message}`);
  process.exit(1);
});
