import { readFileSync, existsSync } from 'fs';
import { createHmac } from 'crypto';
import pg from 'pg';

const API = 'http://localhost:3000/api/v1';
const LOG = 'logs/api.log';
const ADMIN = '+2348012345678';
const PAX = '+2348155550101';
const DRIVER = '+2348098765432';
const EMP = '+2348166660202';

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` - ${extra}` : ''}\n`);
}

function logLines() {
  return existsSync(LOG) ? readFileSync(LOG, 'utf8').split('\n') : [];
}

async function api(path, method = 'GET', body, token, headers = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function waitApi() {
  for (let i = 0; i < 45; i++) {
    const res = await fetch(`${API}/cities`).catch(() => null);
    if (res) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('API never came up');
}

function lastOtpFor(phone) {
  const all = logLines()
    .map((l) => l.match(new RegExp(`OTP for ${phone.replace('+', '\\+')}: (\\d{6})`)))
    .filter(Boolean);
  return all.length ? all[all.length - 1][1] : null;
}

async function login(phone, deviceId) {
  await waitApi();
  const previousOtp = lastOtpFor(phone);
  await api('/auth/send-otp', 'POST', { phone });

  let otp = null;
  for (let i = 0; i < 30 && !otp; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const lines = logLines();
    const fresh = lines
      .slice(Math.max(0, lines.length - 8))
      .map((l) => l.match(new RegExp(`OTP for ${phone.replace('+', '\\+')}: (\\d{6})`)))
      .filter(Boolean);
    if (fresh.length > 0) {
      const candidate = fresh[fresh.length - 1][1];
      if (candidate !== previousOtp || previousOtp === null) otp = candidate;
    }
  }
  if (!otp) throw new Error(`no OTP for ${phone}`);
  const { data } = await api('/auth/verify-otp', 'POST', { phone, code: otp });
  return data;
}

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function totp(secret) {
  let bits = '';
  for (const ch of secret.toUpperCase()) {
    bits += B32.indexOf(ch).toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const key = Buffer.from(bytes);
  const counter = Math.floor(Date.now() / 30000);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter % 2 ** 32, 4);
  const hmac = createHmac('sha1', key).update(buf).digest();
  const off = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[off] & 0x7f) << 24) | ((hmac[off + 1] & 0xff) << 16) |
    ((hmac[off + 2] & 0xff) << 8) | (hmac[off + 3] & 0xff);
  return String(code % 1e6).padStart(6, '0');
}

async function main() {
  await waitApi();
  const client = new pg.Client({
    connectionString:
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/isafedrive',
  });
  await client.connect();
  await client.query(
    'UPDATE users SET twofa_enabled = false, twofa_secret = NULL WHERE phone = $1',
    [ADMIN],
  );
  await client.end();

  const adminLogin = await login(ADMIN);
  const admin = adminLogin.accessToken;
  check('admin login', Boolean(admin));

  const geo = await api('/cities', 'GET', null, admin);
  check('cities seeded', Array.isArray(geo.data) && geo.data.length >= 2, (geo.data.map ? geo.data.map((c) => c.name).join(', ') : JSON.stringify(geo.data)));
  const zones = await api('/admin/zones', 'GET', null, admin);
  check('zones seeded', zones.data.length >= 6, `${zones.data.length} zones`);

  const vi = await api('/rides/estimate', 'POST', {
    categoryId: 'economy',
    pickupLatitude: 6.4281,
    pickupLongitude: 3.4219,
    destinationLatitude: 6.45,
    destinationLongitude: 3.39,
  }, admin);
  check(
    'surge zone pricing (VI)',
    vi.status < 300 && vi.data.zone?.type === 'surge' && Number(vi.data.breakdown.surge_multiplier) >= 1.3,
    `zone=${vi.data.zone?.name}, surge=${vi.data.breakdown?.surge_multiplier}, fare=${vi.data.fare}`,
  );

  const apapa = await api('/rides/estimate', 'POST', {
    categoryId: 'economy',
    pickupLatitude: 6.4489,
    pickupLongitude: 3.3594,
    destinationLatitude: 6.45,
    destinationLongitude: 3.39,
  }, admin);
  check('restricted zone blocks pickup', apapa.status === 400, apapa.data?.message ?? '');

  const corp = await api('/admin/corporate', 'POST', { name: `Acme ${Date.now()}`, adminPhone: ADMIN }, admin);
  const corpId = corp.data.id;
  check('corporate account created', Boolean(corpId), corp.data.message ?? corp.data.name);
  await api(`/admin/corporate/${corpId}/topup`, 'POST', { amount: 100000 }, admin);
  const emp = await api(
    `/admin/corporate/${corpId}/employees`,
    'POST',
    { phone: EMP, monthlyLimit: 50000 },
    admin,
  );
  check('corporate employee added', Boolean(emp.data.id), emp.data.message ?? '');

  const empLogin = await login(EMP);
  const myAccounts = await api('/corporate/my', 'GET', null, empLogin.accessToken);
  check(
    'employee sees corporate account',
    myAccounts.data.some((m) => m.account?.id === corpId),
    myAccounts.data.map((m) => m.account?.name).join(', '),
  );

  const corpRide = await api('/rides', 'POST', {
    categoryId: 'economy',
    pickupAddress: 'IKEA',
    pickupLatitude: 6.55,
    pickupLongitude: 3.36,
    destinationAddress: 'Gbagada',
    destinationLatitude: 6.55,
    destinationLongitude: 3.39,
    corporateAccountId: corpId,
    costCenter: 'Sales',
  }, empLogin.accessToken);
  const corpRideCheck = await api(`/rides/${corpRide.data.id}`, 'GET', null, admin);
  check(
    'corporate ride booked',
    corpRide.status < 300 && Boolean(corpRideCheck.data.corporateAccount?.id),
    `fare=${corpRide.data.fare}, account=${corpRideCheck.data.corporateAccount?.name ?? 'NOT LINKED'}`,
  );
  const invoice = await api(`/admin/corporate/${corpId}/invoice`, 'GET', null, admin);
  check(
    'corporate invoice aggregates rides',
    invoice.status === 200 && invoice.data.rides.length >= 1,
    `period=${invoice.data?.period}, total=${invoice.data?.total}`,
  );

  const fleet = await api('/admin/fleets', 'POST', { name: `Lagos Fleet ${Date.now() % 1000}`, ownerPhone: ADMIN, commissionPercent: 12 }, admin);
  check('fleet created', Boolean(fleet.data.id));
  const fd = await api(`/admin/fleets/${fleet.data.id}/drivers`, 'POST', { driverPhone: DRIVER }, admin);
  check('driver added to fleet', Boolean(fd.data.id));
  const fleetDetail = await api(`/admin/fleets/${fleet.data.id}`, 'GET', null, admin);
  check('fleet detail + performance', fleetDetail.data.drivers.length === 1 && 'performance' in fleetDetail.data);

  const pax = (await login(PAX)).accessToken;
  const dl = await api('/deliveries', 'POST', {
    recipientName: 'Test Recipient',
    recipientPhone: '+2348000000099',
    pickupAddress: 'Yaba',
    pickupLatitude: 6.5,
    pickupLongitude: 3.38,
    dropoffAddress: 'Ikeja',
    dropoffLatitude: 6.6,
    dropoffLongitude: 3.35,
    packageName: 'Laptop charger',
    size: 'medium',
  }, pax);
  check('delivery created with OTP', Boolean(dl.data.proofOtp), `fee=${dl.data.fee}`);
  const driverLogin = await login(DRIVER);
  const driver = driverLogin.accessToken;
  await api(`/deliveries/${dl.data.id}/accept`, 'POST', null, driver);
  await api(`/deliveries/${dl.data.id}/picked-up`, 'POST', null, driver);
  await api(`/deliveries/${dl.data.id}/in-transit`, 'POST', null, driver);
  const done = await api(`/deliveries/${dl.data.id}/complete`, 'POST', { otp: dl.data.proofOtp }, driver);
  check('delivery completed with OTP proof', done.data.status === 'delivered');
  const badOtp = await api(`/deliveries/${dl.data.id}/complete`, 'POST', { otp: '0000' }, driver);
  check('wrong OTP rejected', badOtp.status === 400);

  const chatRide = await api('/rides', 'POST', {
    categoryId: 'economy',
    pickupAddress: 'Surulere',
    pickupLatitude: 6.49,
    pickupLongitude: 3.35,
    destinationAddress: 'Yaba',
    destinationLatitude: 6.51,
    destinationLongitude: 3.38,
  }, pax);
  const sent = await api(`/rides/${chatRide.data.id}/messages`, 'POST', { text: 'I am at the gate' }, pax);
  check('chat message sent', sent.status === 201 || sent.status === 200, sent.data.text);
  const msgs = await api(`/rides/${chatRide.data.id}/messages`, 'GET', null, pax);
  check('chat history', msgs.data.length === 1);
  await api(`/rides/${chatRide.data.id}/accept`, 'POST', null, driver);
  const contact = await api(`/rides/${chatRide.data.id}/contact`, 'GET', null, pax);
  check('masked driver contact', Boolean(contact.data.alias), contact.data.alias ?? contact.data.message);

  const d1 = await api('/auth/quick-login', 'POST', { phone: PAX }, null, { 'X-Device-Id': 'shared-device-123' });
  const d2 = await api('/auth/quick-login', 'POST', { phone: DRIVER }, null, { 'X-Device-Id': 'shared-device-123' });
  check('device captured on logins', Boolean(d1.data.accessToken && d2.data.accessToken));
  const scan = await api('/admin/fraud/scan', 'POST', null, admin);
  check('fraud scan ran', scan.status === 201 || scan.status === 200, `scanned=${scan.data.scanned}`);
  const alerts = await api('/admin/fraud/alerts', 'GET', null, admin);
  const deviceAlert = alerts.data.find((a) => a.rule === 'multiple_accounts_same_device');
  check('shared-device fraud alert raised', Boolean(deviceAlert), deviceAlert ? `severity=${deviceAlert.severity}` : '');
  if (deviceAlert) {
    await api(`/admin/fraud/alerts/${deviceAlert.id}/resolve`, 'POST', null, admin);
  }

  const setup = await api('/admin/2fa/setup', 'POST', null, admin);
  check('2FA setup returns secret + otpauth', Boolean(setup.data.secret && setup.data.otpauthUrl.includes('otpauth://totp')));
  const code = totp(setup.data.secret);
  const enable = await api('/admin/2fa/enable', 'POST', { token: code }, admin);
  check('2FA enabled with valid TOTP', enable.data.enabled === true);
  const otpLogin = await login(ADMIN);
  check('login now requires 2FA', otpLogin.twoFaRequired === true);
  const code2 = totp(setup.data.secret);
  const twofaLogin = await api('/auth/verify-2fa', 'POST', { phone: ADMIN, token: code2 });
  check(
    '2FA login issues tokens',
    Boolean(twofaLogin.data.accessToken),
    JSON.stringify(twofaLogin.data).slice(0, 120),
  );
  const disable = await api(
    '/admin/2fa/disable',
    'POST',
    { token: code2 },
    twofaLogin.data.accessToken,
  );
  check('2FA disabled again', disable.data.enabled === false, JSON.stringify(disable.data).slice(0, 120));

  const failed = results.filter((r) => !r.ok);
  process.stdout.write(`\n${results.length - failed.length}/${results.length} checks passed\n`);
  if (failed.length > 0) process.exit(1);
}

main().catch((e) => {
  process.stderr.write(`verification crashed: ${e.message}\n`);
  process.exit(1);
});
