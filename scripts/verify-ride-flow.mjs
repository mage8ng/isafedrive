const API = 'http://localhost:3000/api/v1';

async function api(path, method = 'GET', body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const results = [];
function check(name, ok, extra = '') {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` - ${extra}` : ''}`);
}

async function main() {
  const driverPhone = '+2348098765432';

  const driver = await api('/auth/quick-login', 'POST', {
    phone: driverPhone,
    fullName: 'Demo Driver',
    role: 'driver',
  });
  check('driver login (auto-provisioned)', Boolean(driver.data.accessToken), `role=${driver.data.user?.role}`);
  const dt = driver.data.accessToken;

  const profile = await api('/drivers/profile', 'GET', null, dt);
  check('driver profile exists', profile.status === 200, `kyc=${profile.data?.kycStatus}`);

  await api('/drivers/go-online', 'POST', { latitude: 6.6018, longitude: 3.3515 }, dt);
  const online = await api('/drivers/profile', 'GET', null, dt);
  check('driver online', online.data?.onlineStatus === 'online');

  const pax = await api('/auth/quick-login', 'POST', {
    phone: '+2348155550101',
    fullName: 'Test Rider',
    role: 'passenger',
  });
  const pt = pax.data.accessToken;
  check('passenger login', Boolean(pt));

  const est = await api('/rides/estimate', 'POST', {
    categoryId: 'economy',
    pickupLatitude: 6.6018,
    pickupLongitude: 3.3515,
    destinationLatitude: 6.4281,
    destinationLongitude: 3.4219,
  }, pt);
  check('fare estimate', est.status < 300, `₦${est.data.fare} for ${est.data.distanceKm} km`);

  const ride = await api('/rides', 'POST', {
    categoryId: 'economy',
    pickupAddress: 'Ikeja City Mall',
    pickupLatitude: 6.6018,
    pickupLongitude: 3.3515,
    destinationAddress: 'Victoria Island',
    destinationLatitude: 6.4281,
    destinationLongitude: 3.4219,
    paymentMethod: 'cash',
  }, pt);
  check('ride booked', ride.status < 300, `pin=${ride.data.ridePin}, fare=${ride.data.fare}`);
  const rideId = ride.data.id;

  const available = await api('/drivers/available-rides', 'GET', null, dt);
  check('driver sees ride request', available.data.some((r) => r.id === rideId), `${available.data.length} searching`);

  const tracking0 = await api(`/rides/${rideId}/tracking`, 'GET', null, pt);
  check('passenger tracking endpoint', tracking0.status === 200 && Boolean(tracking0.data.ridePin));

  const accept = await api(`/rides/${rideId}/accept`, 'POST', null, dt);
  check('driver accepted', accept.data.status === 'driver_assigned');

  const tracking1 = await api(`/rides/${rideId}/tracking`, 'GET', null, pt);
  check('passenger sees driver info', Boolean(tracking1.data.driver?.phone), `${tracking1.data.driver?.name}`);

  await api('/rides/' + rideId + '/arrived', 'POST', null, dt);
  const arrived = await api(`/rides/${rideId}/tracking`, 'GET', null, dt);
  check('driver arrived', arrived.data.status === 'driver_arrived');

  const badPin = await api(`/rides/${rideId}/start`, 'POST', { pin: '0000' }, dt);
  check('wrong PIN rejected', badPin.status === 400);

  const start = await api(`/rides/${rideId}/start`, 'POST', { pin: ride.data.ridePin }, dt);
  check('trip started with PIN', start.data.status === 'in_progress');

  await api('/drivers/location', 'PUT', { latitude: 6.5, longitude: 3.39 }, dt);

  const complete = await api(`/rides/${rideId}/complete`, 'POST', null, dt);
  check('trip completed', complete.data.status === 'completed');

  const earnings = await api('/drivers/earnings', 'GET', null, dt);
  check('driver earnings update', Boolean(earnings.data), `completed=${earnings.data.statistics?.completedRides}`);

  await api('/drivers/go-offline', 'POST', null, dt);
  const offline = await api('/drivers/profile', 'GET', null, dt);
  check('driver offline', offline.data.onlineStatus === 'offline');

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error('crashed:', e.message);
  process.exit(1);
});
