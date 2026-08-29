const API = 'http://localhost:3000/api/v1';
const results = [];
function check(name, ok, extra = '') {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` - ${extra}` : ''}`);
}

async function req(path, method = 'GET', body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function main() {
  const pax = await req('/auth/quick-login', 'POST', { phone: '+2348155550101', fullName: 'Test Rider', role: 'passenger' });
  const pt = pax.data.accessToken;

  const prof = await req('/passengers/profile', 'GET', null, pt);
  check('passenger GET profile', prof.status === 200 && prof.data.phone === '+2348155550101', prof.data.fullName);

  const tinyPhoto =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const upd = await req('/passengers/profile', 'PUT', { fullName: 'Test Rider', profilePhoto: tinyPhoto }, pt);
  check('passenger update + photo upload', upd.status === 200 && Boolean(upd.data.profilePhoto), upd.data.fullName);

  const leak = await req('/passengers/profile', 'GET', null, pt);
  check('no passwordHash leak', !('passwordHash' in leak.data) && !('twofaSecret' in leak.data));

  const drv = await req('/auth/quick-login', 'POST', { phone: '+2348098765432', fullName: 'Demo Driver', role: 'driver' });
  const dt = drv.data.accessToken;

  const dprof = await req('/drivers/profile', 'GET', null, dt);
  check(
    'driver GET profile (user + driver)',
    dprof.status === 200 && Boolean(dprof.data.user?.phone) && Boolean(dprof.data.driver?.kycStatus),
    `kyc=${dprof.data?.driver?.kycStatus}`,
  );
  check('driver profile no leak', !('passwordHash' in (dprof.data.user ?? {})));

  const dupd = await req('/drivers/profile', 'PUT', { fullName: 'Demo Driver', profilePhoto: tinyPhoto }, dt);
  check('driver update + photo upload', dupd.status === 200 && Boolean(dupd.data.user?.profilePhoto));

  await req('/drivers/go-online', 'POST', { latitude: 6.6018, longitude: 3.3515 }, dt);
  const near = await req('/rides/nearby-drivers', 'GET', null, pt);
  check(
    'nearby drivers for passenger map',
    near.status === 200 && near.data.length >= 1,
    near.data.map?.((d) => `${d.name} @ ${Number(d.lat).toFixed(3)},${Number(d.lng).toFixed(3)}`).join(' | '),
  );

  await req('/drivers/go-offline', 'POST', null, dt);
  const nearAfter = await req('/rides/nearby-drivers', 'GET', null, pt);
  check('offline drivers hidden from map', nearAfter.data.length === 0);

  const pages = ['/', '/driver/'];
  for (const p of pages) {
    const r = await fetch(`http://localhost:3000${p}`);
    check(`page ${p}`, r.ok);
  }

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error('crashed:', e.message);
  process.exit(1);
});
