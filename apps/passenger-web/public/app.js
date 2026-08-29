const API = localStorage.getItem('isafedrive_api') || (window.location.origin + '/api/v1');

const CATEGORIES = [
  { id: 'economy', name: 'Economy', ico: '🚕' },
  { id: 'comfort', name: 'Comfort', ico: '🚙' },
  { id: 'xl', name: 'XL', ico: '🚐' },
  { id: 'premium', name: 'Premium', ico: '⭐' },
  { id: 'motorcycle', name: 'Bike', ico: '🏍️' },
  { id: 'tricycle', name: 'Keke', ico: '🛺' },
];

const STAGES = [
  { label: 'Finding driver', match: ['requested', 'searching'] },
  { label: 'Driver assigned', match: ['driver_assigned'] },
  { label: 'Driver arrived', match: ['driver_arrived'] },
  { label: 'On the trip', match: ['in_progress', 'passenger_onboard'] },
  { label: 'Completed', match: ['completed'] },
];

let token = localStorage.getItem('itd') || sessionStorage.getItem('token') || '';
let meId = localStorage.getItem('itd_uid') || '';
let lastRideStatus = null;
let lastPaymentStatus = null;
let defaultPayMethod = localStorage.getItem('itd_pay') || 'cash';

function setToken(t) {
  token = t || '';
  if (token) {
    localStorage.setItem('itd', token);
    sessionStorage.setItem('token', token);
  } else {
    localStorage.removeItem('itd');
    sessionStorage.removeItem('token');
  }
}

function clearToken() {
  setToken('');
}

let map = null;
let userMarker = null;
let destMarker = null;
let driverMarker = null;
let routeLayerId = 'route-line';
let routeSourceAdded = false;
let selectedCategory = 'economy';
let pickup = null;
let destination = null;
let currentRideId = null;
let pollTimer = null;
let chatTimer = null;
let searchTarget = null;
let searchDebounce = null;

const $ = (id) => document.getElementById(id);

function toast(text, ms = 2600) {
  const t = $('toast');
  t.textContent = text;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), ms);
}

async function api(path, method = 'GET', body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) return logout();
    throw new Error(data.message ?? `Request failed (${res.status})`);
  }
  return data;
}

function initMap() {
  map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors',
        },
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
    center: [3.3792, 6.5244],
    zoom: 13,
    pitch: 48,
    bearing: -18,
    attributionControl: false,
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.on('load', () => {
    map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    routeSourceAdded = true;
  });
}

function setUserMarker(lat, lng, accuracy) {
  if (!map) return;
  if (userMarker) {
    userMarker.setLngLat([lng, lat]);
  } else {
    const el = document.createElement('div');
    el.className = 'user-dot';
    el.innerHTML = '<div class="user-pulse"></div><div class="user-core"></div>';
    userMarker = new maplibregl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(map);
  }
  if (accuracy && !window._accSrc) {
    window._accSrc = { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: { accuracy } } };
    map.addSource('accuracy', window._accSrc);
    map.addLayer({
      id: 'accuracy-fill',
      type: 'fill',
      source: 'accuracy',
      paint: { 'fill-color': '#1d4ed8', 'fill-opacity': 0.08 },
    });
  } else if (window._accSrc) {
    window._accSrc.data.geometry.coordinates = [lng, lat];
    window._accSrc.data.properties.accuracy = accuracy;
    map.getSource('accuracy')?.setData(window._accSrc.data);
  }
}

function setDestMarker(lat, lng) {
  if (destMarker) destMarker.remove();
  const el = document.createElement('div');
  el.className = 'dest-pin';
  el.textContent = '📍';
  destMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
    .setLngLat([lng, lat])
    .addTo(map);
}

function setDriverMarker(lat, lng) {
  if (!map || lat == null) return;
  if (driverMarker) {
    driverMarker.setLngLat([lng, lat]);
  } else {
    const el = document.createElement('div');
    el.className = 'driver-car';
    el.textContent = '🚕';
    driverMarker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
  }
}

async function drawRoute(from, to) {
  if (!map || !routeSourceAdded) return;
  let coords = [
    [from.lng, from.lat],
    [to.lng, to.lat],
  ];
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const json = await res.json();
    const line = json?.routes?.[0]?.geometry?.coordinates;
    if (Array.isArray(line) && line.length > 1) coords = line;
  } catch {}
  map.getSource('route')?.setData({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: {},
  });
  if (!map.getLayer(routeLayerId)) {
    map.addLayer({
      id: routeLayerId,
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#1d4ed8', 'line-width': 5, 'line-opacity': 0.85 },
    });
  }
  const bounds = coords.reduce(
    (b, c) => b.extend(c),
    new maplibregl.LngLatBounds(coords[0], coords[0]),
  );
  map.fitBounds(bounds, { padding: 90, maxZoom: 16, pitch: 45 });
}

async function searchPlaces(q) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=ng&q=${encodeURIComponent(q)}`,
  );
  return res.json();
}

function showResults(results) {
  const box = $('search-results');
  box.innerHTML = '';
  if (!results.length) {
    box.innerHTML = '<div class="muted">No places found</div>';
    box.classList.remove('hidden');
    return;
  }
  for (const r of results) {
    const div = document.createElement('div');
    const name = r.display_name.split(',').slice(0, 2).join(', ');
    div.innerHTML = `<b>${name}</b><div class="sub">${r.display_name}</div>`;
    div.onclick = () => {
      const lat = parseFloat(r.lat);
      const lng = parseFloat(r.lon);
      box.classList.add('hidden');
      if (searchTarget === 'dest') {
        destination = { lat, lng, address: r.display_name.split(',').slice(0, 3).join(', ') };
        $('in-dest').value = destination.address;
        setDestMarker(lat, lng);
        loadNearbyDrivers();
        doEstimate();
      } else {
        pickup = { lat, lng, address: r.display_name.split(',').slice(0, 3).join(', ') };
        $('in-pickup').value = pickup.address;
        map.flyTo({ center: [lng, lat], zoom: 15, pitch: 48 });
      }
      $('estimate-box').classList.add('hidden');
    };
    box.appendChild(div);
  }
  box.classList.remove('hidden');
}

function wireSearch() {
  for (const [inputId, target] of [
    ['in-pickup', 'pickup'],
    ['in-dest', 'dest'],
  ]) {
    $(inputId).addEventListener('focus', () => (searchTarget = target));
    $(inputId).addEventListener('input', (e) => {
      searchTarget = target;
      const q = e.target.value.trim();
      clearTimeout(searchDebounce);
      if (q.length < 3) return;
      searchDebounce = setTimeout(async () => {
        try {
          showResults(await searchPlaces(q));
        } catch {}
      }, 450);
    });
  }
}

async function refreshWallet() {
  try {
    const w = await api('/passengers/wallet');
    $('wallet-chip').textContent = `Wallet ₦${Number(w.balance).toLocaleString()}`;
    $('wallet-chip').classList.remove('hidden');
    if ($('ac-wallet-bal')) $('ac-wallet-bal').textContent = `₦${Number(w.balance).toLocaleString()}`;
    window._walletBalance = Number(w.balance);
  } catch {}
}

function renderCategories() {
  const box = $('categories');
  box.innerHTML = '';
  for (const c of CATEGORIES) {
    const b = document.createElement('button');
    b.className = `cat${c.id === selectedCategory ? ' selected' : ''}`;
    b.innerHTML = `<span class="ico">${c.ico}</span><span class="nm">${c.name}</span>`;
    b.onclick = () => {
      selectedCategory = c.id;
      $('estimate-box').classList.add('hidden');
      renderCategories();
    };
    box.appendChild(b);
  }
}

function coords() {
  const p = pickup ?? window._gps ?? { lat: 6.5244, lng: 3.3792, address: 'Current Location' };
  const d =
    destination ??
    { lat: 6.4281, lng: 3.4219, address: $('in-dest').value.trim() || 'Destination' };
  return {
    pickupAddress: (p.address || 'Current Location').toString(),
    pickupLatitude: Number(p.lat),
    pickupLongitude: Number(p.lng),
    destinationAddress: (d.address || 'Destination').toString(),
    destinationLatitude: Number(d.lat),
    destinationLongitude: Number(d.lng),
  };
}

async function doEstimate() {
  toast('Calculating fare...');
  try {
    const e = await api('/rides/estimate', 'POST', {
      categoryId: selectedCategory,
      pickupLatitude: coords().pickupLatitude,
      pickupLongitude: coords().pickupLongitude,
      destinationLatitude: coords().destinationLatitude,
      destinationLongitude: coords().destinationLongitude,
    });
    $('estimate-box').innerHTML =
      `<b>₦${e.fare.toLocaleString()}</b> · ${e.distanceKm} km · ~${e.durationMinutes} min` +
      (e.zone ? ` · ${e.zone.name}` : '');
    $('estimate-box').classList.remove('hidden');
    drawRoute(
      { lat: coords().pickupLatitude, lng: coords().pickupLongitude },
      { lat: coords().destinationLatitude, lng: coords().destinationLongitude },
    );
  } catch (err) {
    toast(err.message);
  }
}

async function doBook() {
  const btn = $('btn-book');
  btn.disabled = true;
  btn.textContent = 'Booking...';
  try {
    const ride = await api('/rides', 'POST', {
      categoryId: selectedCategory,
      paymentMethod: defaultPayMethod || 'cash',
      ...coords(),
    });
    openTracking(ride.id);
  } catch (err) {
    toast(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Book ride';
  }
}

function stageFor(status) {
  return STAGES.findIndex((s) => s.match.includes(status));
}

function renderTimeline(status) {
  const idx = status === 'cancelled' ? -1 : stageFor(status);
  $('timeline').innerHTML = STAGES.map((s, i) => {
    const cls = i < idx ? 'done' : i === idx ? 'now' : '';
    return `<li class="${cls}"><span class="t-dot"></span>${s.label}</li>`;
  }).join('');
}

function trackCopy(status) {
  switch (status) {
    case 'requested':
    case 'searching':
      return ['Finding your driver', 'Matching nearby drivers'];
    case 'driver_assigned':
      return ['Driver on the way', 'Heading to your pickup point'];
    case 'driver_arrived':
      return ['Driver arrived', 'Share your PIN to start the trip'];
    case 'in_progress':
      return ['Enjoy your ride', 'On the way to your destination'];
    case 'completed':
      return ['Trip completed', 'Thanks for riding with iSafeDrive'];
    case 'cancelled':
      return ['Ride cancelled', 'This trip was cancelled'];
    default:
      return [status, ''];
  }
}

function paintTracking(t) {
  const [title, sub] = trackCopy(t.status);
  $('track-status').textContent = t.status.replaceAll('_', ' ');
  $('track-title').textContent = title;
  $('track-sub').textContent = sub;
  $('ride-pin').textContent = t.ridePin ?? '- - - -';
  $('ride-fare').textContent = `₦${Number(t.fare ?? 0).toLocaleString()}`;
  renderTimeline(t.status);

  if (t.driver) {
    $('driver-card').classList.remove('hidden');
    $('driver-name').textContent = t.driver.name;
    $('driver-meta').textContent = `${t.driver.rating} ★ · ${t.driver.phone}`;
    if (t.driver.lat != null) setDriverMarker(t.driver.lat, t.driver.lng);
  } else {
    $('driver-card').classList.add('hidden');
  }

  const cancellable = ['requested', 'searching', 'driver_assigned', 'driver_arrived'].includes(t.status);
  $('btn-cancel-ride').classList.toggle('hidden', !cancellable);
  $('btn-track-close').classList.toggle('hidden', !['completed', 'cancelled'].includes(t.status));

  const payCard = $('pay-card');
  if (t.status === 'completed' && t.paymentStatus !== 'paid') {
    payCard.classList.remove('hidden');
    $('pay-amount').textContent = `₦${Number(t.fare ?? 0).toLocaleString()}`;
    $('pay-status').textContent = '';
  } else if (t.paymentStatus === 'paid') {
    payCard.classList.remove('hidden');
    $('pay-amount').textContent = `₦${Number(t.fare ?? 0).toLocaleString()}`;
    $('pay-status').textContent = '✓ Paid' + (t.paymentMethod ? ` via ${t.paymentMethod}` : '');
    $('btn-pay').disabled = true;
    $('btn-pay').textContent = 'Paid';
  } else {
    payCard.classList.add('hidden');
  }
}

function openTracking(rideId) {
  currentRideId = rideId;
  $('sheet').classList.add('hidden');
  $('search-panel').classList.add('hidden');
  $('view-track').classList.remove('hidden');
  clearInterval(pollTimer);
  clearInterval(chatTimer);
  pollTimer = setInterval(pollTracking, 3500);
  chatTimer = setInterval(loadChat, 5000);
  pollTracking();
  loadChat();
}

async function pollTracking() {
  if (!currentRideId) return;
  try {
    const t = await api(`/rides/${currentRideId}/tracking`);
    paintTracking(t);
    if (t.driver?.lat != null && t.pickup) {
      drawRoute({ lat: t.driver.lat, lng: t.driver.lng }, { lat: t.pickup.lat, lng: t.pickup.lng });
    }
    rideStatusToast(t);
    if (['completed', 'cancelled'].includes(t.status)) {
      clearInterval(pollTimer);
      refreshWallet();
    }
  } catch {}
}

function rideStatusToast(t) {
  const s = t.status;
  if (s !== lastRideStatus) {
    switch (s) {
      case 'driver_assigned':
        toast('Driver assigned');
        break;
      case 'driver_arrived':
        toast('Driver arrived');
        break;
      case 'in_progress':
      case 'passenger_onboard':
        toast('Trip started');
        break;
      case 'completed':
        toast('Trip completed');
        break;
    }
    lastRideStatus = s;
  }
  const ps = t.paymentStatus;
  if (ps && ps !== lastPaymentStatus) {
    if (ps === 'paid') toast('Payment received');
    lastPaymentStatus = ps;
  }
}

async function loadChat() {
  if (!currentRideId) return;
  try {
    const messages = await api(`/rides/${currentRideId}/messages`);
    const log = $('chat-log');
    log.innerHTML = messages.length
      ? messages.map((m) => `<div class="chat-msg"><b>${m.sender?.phone ?? ''}</b>: ${m.text}</div>`).join('')
      : '<span class="muted small">No messages yet</span>';
    log.scrollTop = log.scrollHeight;
  } catch {}
}

async function sendChat() {
  const text = $('chat-text').value.trim();
  if (!text || !currentRideId) return;
  $('chat-text').value = '';
  try {
    await api(`/rides/${currentRideId}/messages`, 'POST', { text });
    loadChat();
  } catch (err) {
    toast(err.message);
  }
}

async function cancelRide() {
  if (!currentRideId) return;
  try {
    await api(`/rides/${currentRideId}/cancel`, 'POST');
    pollTracking();
  } catch (err) {
    toast(err.message);
  }
}

let selectedPayMethod = 'cash';

async function doPay() {
  if (!currentRideId) return;
  const btn = $('btn-pay');
  btn.disabled = true;
  try {
    const r = await api(`/rides/${currentRideId}/pay`, 'POST', { method: selectedPayMethod });
    $('pay-status').textContent = `✓ Paid via ${selectedPayMethod}`;
    toast('Payment successful - thank you!');
    btn.textContent = 'Paid';
    refreshWallet();
  } catch (err) {
    $('pay-status').textContent = err.message;
    btn.disabled = false;
  }
}

async function maskedCall() {
  if (!currentRideId) return;
  try {
    const c = await api(`/rides/${currentRideId}/contact`);
    toast(`Dial ${c.alias} - your numbers stay private`);
  } catch (err) {
    toast(err.message);
  }
}

function closeTracking() {
  currentRideId = null;
  clearInterval(pollTimer);
  clearInterval(chatTimer);
  $('view-track').classList.add('hidden');
  $('sheet').classList.remove('hidden');
  $('search-panel').classList.remove('hidden');
  if (driverMarker) {
    driverMarker.remove();
    driverMarker = null;
  }
  map.getSource('route')?.setData({ type: 'FeatureCollection', features: [] });
  loadHistory();
}

async function loadHistory() {
  const list = $('rides-list');
  try {
    const rides = await api('/passengers/rides');
    list.innerHTML = rides.length
      ? ''
      : '<li class="muted" style="display:block">No rides yet - book your first one!</li>';
    for (const r of rides) {
      const li = document.createElement('li');
      li.innerHTML =
        `<div><div class="where">${r.destinationAddress}</div>` +
        `<div class="when">${new Date(r.requestedAt).toLocaleString()}</div></div>` +
        `<div style="text-align:right"><div><b>₦${Number(r.fare).toLocaleString()}</b></div>` +
        `<span class="badge">${r.status.replaceAll('_', ' ')}</span></div>`;
      li.onclick = () => {
        destination = {
          lat: r.destinationLatitude,
          lng: r.destinationLongitude,
          address: r.destinationAddress,
        };
        openTracking(r.id);
      };
      list.appendChild(li);
    }
  } catch (err) {
    list.innerHTML = `<li class="muted" style="display:block">${err.message}</li>`;
  }
}

async function sendDelivery() {
  const btn = $('btn-dl-send');
  btn.disabled = true;
  try {
    const c = coords();
    await api('/deliveries', 'POST', {
      recipientName: $('dl-name').value.trim() || 'Recipient',
      recipientPhone: $('dl-phone').value.trim() || '+2340000000000',
      pickupAddress: c.pickupAddress,
      pickupLatitude: c.pickupLatitude,
      pickupLongitude: c.pickupLongitude,
      dropoffAddress: c.destinationAddress,
      dropoffLatitude: c.destinationLatitude,
      dropoffLongitude: c.destinationLongitude,
      packageName: $('dl-item').value.trim() || 'Package',
      size: $('dl-size').value,
    });
    toast('Package request sent - driver will pick it up');
    $('dl-name').value = '';
    $('dl-phone').value = '';
    $('dl-item').value = '';
    loadDeliveries();
  } catch (err) {
    toast(err.message);
  } finally {
    btn.disabled = false;
  }
}

async function loadDeliveries() {
  const list = $('dl-list');
  try {
    const items = await api('/deliveries');
    list.innerHTML = '';
    for (const d of items) {
      const li = document.createElement('li');
      li.innerHTML =
        `<div><div class="where">${d.packageName} → ${d.dropoffAddress}</div>` +
        `<div class="when">OTP proof on delivery</div></div>` +
        `<div style="text-align:right"><div><b>₦${Number(d.fee).toLocaleString()}</b></div>` +
        `<span class="badge">${d.status.replaceAll('_', ' ')}</span></div>`;
      list.appendChild(li);
    }
    if (!items.length) list.innerHTML = '<li class="muted" style="display:block">No deliveries yet.</li>';
  } catch {}
}

let nearbyTimer = null;
const nearbyMarkers = new Map();

async function loadNearbyDrivers() {
  if (!map) return;
  try {
    const drivers = await api('/rides/nearby-drivers');
    const seen = new Set();
    for (const d of drivers) {
      seen.add(d.driverId);
      const key = `nearby-${d.driverId}`;
      let marker = nearbyMarkers.get(key);
      const label = d.vehicle ? `${d.vehicle.make} ${d.vehicle.model}` : d.name;
      if (marker) {
        marker.setLngLat([d.lng, d.lat]);
      } else {
        const el = document.createElement('div');
        el.className = 'nearby-cab';
        el.innerHTML = `<div class="cab-label">${label}</div><div class="cab-ico">🚕</div>`;
        marker = new maplibregl.Marker({ element: el })
          .setLngLat([d.lng, d.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 30 }).setHTML(
              `<b>${d.name}</b> · ${d.rating} ★<br/>` +
                (d.vehicle ? `${d.vehicle.color ?? ''} ${d.vehicle.make} ${d.vehicle.model}<br/>Plate: ${d.vehicle.plate}` : 'Cab'),
            ),
          )
          .addTo(map);
        nearbyMarkers.set(key, marker);
      }
    }
    for (const [key, marker] of nearbyMarkers) {
      if (!seen.has(key.replace('nearby-', ''))) {
        marker.remove();
        nearbyMarkers.delete(key);
      }
    }
    const chip = $('wallet-chip');
    if (drivers.length) {
      chip.dataset.cabs = `${drivers.length} cabs nearby`;
    }
  } catch {}
}

async function loadProfile() {
  try {
    const p = await api('/passengers/profile');
    if (p.id) {
      meId = p.id;
      localStorage.setItem('itd_uid', p.id);
    }
    $('profile-name').textContent = p.fullName ?? 'Rider';
    $('profile-phone').textContent = p.phone;
    $('profile-rating').textContent = `${p.rating} ★`;
    $('pf-name').value = p.fullName ?? '';
    $('pf-email').value = p.email ?? '';
    if (p.profilePhoto) {
      $('avatar-img').src = p.profilePhoto;
      $('avatar-img').classList.remove('hidden');
      $('avatar-fallback').classList.add('hidden');
    } else {
      $('avatar-fallback').textContent = (p.fullName ?? 'R')[0].toUpperCase();
    }
  } catch (err) {
    toast(err.message);
  }
}

function resizeImage(file, maxSize, cb) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      cb(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function saveProfile() {
  try {
    const p = await api('/passengers/profile', 'PUT', {
      fullName: $('pf-name').value.trim(),
      email: $('pf-email').value.trim() || undefined,
    });
    $('profile-name').textContent = p.fullName ?? 'Rider';
    toast('Profile saved');
    $('pf-msg').textContent = '';
  } catch (err) {
    $('pf-msg').textContent = err.message;
  }
}

function wireProfile() {
  $('btn-avatar').onclick = () => $('in-avatar').click();
  $('in-avatar').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    resizeImage(file, 512, async (dataUrl) => {
      try {
        const p = await api('/passengers/profile', 'PUT', { profilePhoto: dataUrl });
        $('avatar-img').src = p.profilePhoto;
        $('avatar-img').classList.remove('hidden');
        $('avatar-fallback').classList.add('hidden');
        toast('Photo updated');
      } catch (err) {
        toast(err.message);
      }
    });
    e.target.value = '';
  };
  $('btn-save-profile').onclick = saveProfile;
}

function enterApp() {
  $('view-auth').classList.add('hidden');
  $('search-panel').classList.remove('hidden');
  $('sheet').classList.remove('hidden');
  $('btn-logout').classList.remove('hidden');
  renderCategories();
  refreshWallet();
  loadHistory();
  loadProfile();
  wireProfile();
  loadNearbyDrivers();
  clearInterval(nearbyTimer);
  nearbyTimer = setInterval(loadNearbyDrivers, 8000);
}

function logout() {
  clearInterval(pollTimer);
  clearInterval(chatTimer);
  clearToken();
  location.reload();
}

async function doContinue() {
  const phone = $('in-phone').value.trim();
  if (!phone) return toast('Enter your phone number');
  const btn = $('btn-quick');
  btn.disabled = true;
  try {
    const res = await api('/auth/quick-login', 'POST', {
      phone,
      fullName: $('in-name').value.trim() || undefined,
      role: 'passenger',
    });
    setToken(res.accessToken);
    enterApp();
  } catch (err) {
    $('auth-msg').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

async function doLogin() {
  const phone = $('in-phone').value.trim();
  const password = $('in-password').value;
  if (!phone || !password) return toast('Enter phone and password');
  const btn = $('btn-login');
  btn.disabled = true;
  try {
    const res = await api('/auth/login', 'POST', { phone, password });
    setToken(res.accessToken);
    $('view-auth').classList.add('hidden');
    enterApp();
  } catch (err) {
    $('auth-msg').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

async function doRegister() {
  const fullName = $('in-name').value.trim();
  const phone = $('in-reg-phone').value.trim();
  const password = $('in-reg-password').value;
  if (!fullName || !phone || !password) return toast('Fill all fields');
  if (password.length < 8) return toast('Password must be at least 8 characters');
  const pay = document.querySelector('input[name="regpay"]:checked')?.value || 'cash';
  defaultPayMethod = pay === 'later' ? 'cash' : pay;
  localStorage.setItem('itd_pay', defaultPayMethod);
  const btn = $('btn-register');
  btn.disabled = true;
  try {
    await api('/auth/register', 'POST', {
      fullName,
      phone,
      password,
      role: 'passenger',
      paymentMethod: defaultPayMethod,
    });
    const res = await api('/auth/login', 'POST', { phone, password });
    setToken(res.accessToken);
    $('view-auth').classList.add('hidden');
    enterApp();
  } catch (err) {
    $('auth-msg').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

async function doGoogleLogin() {
  if (!window.GOOGLE_CLIENT_ID) {
    toast('Google sign-in is not configured');
    return;
  }
  try {
    const idToken = await googleIdentityPopup(window.GOOGLE_CLIENT_ID);
    const res = await api('/auth/google', 'POST', { idToken, role: 'passenger' });
    setToken(res.accessToken);
    $('view-auth').classList.add('hidden');
    enterApp();
  } catch (err) {
    $('auth-msg').textContent = err.message || 'Google sign-in failed';
  }
}

function googleIdentityPopup(clientId) {
  return new Promise((resolve, reject) => {
    const url =
      'https://accounts.google.com/gsi/accounts/select?client_id=' +
      encodeURIComponent(clientId) +
      '&redirect_uri=' +
      encodeURIComponent(location.origin) +
      '&response_type=token%20id_token&scope=openid%20email%20profile&nonce=' +
      Date.now();
    const w = window.open(url, 'google', 'width=480,height=600');
    if (!w) return reject(new Error('Popup blocked'));
    const onMsg = (e) => {
      if (e.data && e.data.id_token) {
        cleanup();
        resolve(e.data.id_token);
      }
    };
    const poll = setInterval(() => {
      if (w.closed) {
        cleanup();
        reject(new Error('Google sign-in cancelled'));
      }
    }, 800);
    function cleanup() {
      clearInterval(poll);
      window.removeEventListener('message', onMsg);
    }
    window.addEventListener('message', onMsg);
  });
}

async function sendEmailOtp() {
  const email = $('in-otp-email').value.trim();
  if (!email) return toast('Enter your email');
  const btn = $('btn-send-otp');
  btn.disabled = true;
  try {
    await api('/auth/send-email-otp', 'POST', { email });
    $('in-otp-code').classList.remove('hidden');
    $('btn-verify-otp').classList.remove('hidden');
    toast('Code sent (check server logs in dev)');
  } catch (err) {
    $('auth-msg').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

async function verifyEmailOtp() {
  const email = $('in-otp-email').value.trim();
  const code = $('in-otp-code').value.trim();
  if (!email || !code) return toast('Enter email and code');
  const btn = $('btn-verify-otp');
  btn.disabled = true;
  try {
    const res = await api('/auth/verify-email-otp', 'POST', { email, code });
    setToken(res.accessToken);
    $('view-auth').classList.add('hidden');
    enterApp();
  } catch (err) {
    $('auth-msg').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

function wireAuthTabs() {
  document.querySelectorAll('.atab').forEach((t) => {
    t.onclick = () => {
      document.querySelectorAll('.atab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      const tab = t.dataset.atab;
      $('auth-login').classList.toggle('hidden', tab !== 'login');
      $('auth-register').classList.toggle('hidden', tab !== 'register');
      $('auth-msg').textContent = '';
    };
  });
}

function startGps() {
  if (!('geolocation' in navigator)) return;
  navigator.geolocation.watchPosition(
    (pos) => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
      window._gps = p;
      setUserMarker(p.lat, p.lng, p.accuracy);
      if (!window._gpsFocused) {
        window._gpsFocused = true;
        if (!destination && map) map.flyTo({ center: [p.lng, p.lat], zoom: 15.5, pitch: 48, bearing: -18 });
      }
    },
    () => toast('Allow location access for accurate pickup', 4000),
    { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 },
  );
}

function openAccount() {
  $('view-account').classList.remove('hidden');
  showAccountSection('menu');
}

function closeAccount() {
  $('view-account').classList.add('hidden');
}

function showAccountSection(name) {
  const titles = {
    profile: 'Profile',
    payment: 'Payment',
    support: 'Support',
    safety: 'Safety',
    places: 'Saved Places',
    earn: 'Earn with iSafeDrive',
    settings: 'Settings',
  };
  $('ac-title').textContent = titles[name] || 'Account';
  $('ac-menu').classList.toggle('hidden', name !== 'menu');
  document.querySelectorAll('.ac-content').forEach((el) => el.classList.add('hidden'));
  const el = $(`ac-${name}`);
  if (el) el.classList.remove('hidden');
  if (name === 'profile') loadAccountProfile();
  if (name === 'payment') refreshWallet();
  if (name === 'places') renderSavedPlaces();
  if (name === 'earn') renderReferral();
}

async function loadAccountProfile() {
  try {
    const p = await api('/passengers/profile');
    if (p.id) {
      meId = p.id;
      localStorage.setItem('itd_uid', p.id);
    }
    $('ac-name-disp').textContent = p.fullName ?? 'Rider';
    $('ac-phone-disp').textContent = p.phone ?? '';
    $('ac-name').value = p.fullName ?? '';
    $('ac-email').value = p.email ?? '';
    if (p.profilePhoto) {
      $('ac-avatar-img').src = p.profilePhoto;
      $('ac-avatar-img').classList.remove('hidden');
      $('ac-avatar-fallback').classList.add('hidden');
    } else {
      $('ac-avatar-fallback').textContent = (p.fullName ?? 'R')[0].toUpperCase();
    }
  } catch (err) {
    toast(err.message);
  }
}

async function saveAccountProfile() {
  try {
    const p = await api('/passengers/profile', 'PUT', {
      fullName: $('ac-name').value.trim(),
      email: $('ac-email').value.trim() || undefined,
    });
    $('ac-name-disp').textContent = p.fullName ?? 'Rider';
    toast('Profile saved');
    $('ac-pf-msg').textContent = '';
    loadProfile();
  } catch (err) {
    $('ac-pf-msg').textContent = err.message;
  }
}

function wireAccountAvatar() {
  $('ac-avatar-btn').onclick = () => $('ac-avatar-in').click();
  $('ac-avatar-in').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    resizeImage(file, 512, async (dataUrl) => {
      try {
        const p = await api('/passengers/profile', 'PUT', { profilePhoto: dataUrl });
        $('ac-avatar-img').src = p.profilePhoto;
        $('ac-avatar-img').classList.remove('hidden');
        $('ac-avatar-fallback').classList.add('hidden');
        toast('Photo updated');
        loadProfile();
      } catch (err) {
        toast(err.message);
      }
    });
    e.target.value = '';
  };
}

async function topUpWallet() {
  const amt = parseFloat($('ac-topup-amt').value);
  if (!amt || amt <= 0) return toast('Enter a valid amount');
  const btn = $('ac-topup-btn');
  btn.disabled = true;
  try {
    await api('/passengers/wallet/deposit', 'POST', { amount: amt });
    await refreshWallet();
    $('ac-topup-amt').value = '';
    $('ac-topup-msg').textContent = `Added ₦${amt.toLocaleString()} to your wallet`;
    toast('Wallet topped up');
  } catch (err) {
    $('ac-topup-msg').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

async function loadNotifications() {
  const list = $('notif-list');
  try {
    const notes = await api('/notifications');
    if (!notes.length) {
      list.innerHTML = '<li class="muted">No notifications</li>';
      return;
    }
    list.innerHTML = '';
    for (const n of notes) {
      const li = document.createElement('li');
      li.innerHTML =
        `<div class="notif-title">${n.title}</div>` +
        `<div class="notif-msg">${n.message}</div>` +
        `<div class="notif-time">${new Date(n.createdAt).toLocaleString()}</div>`;
      list.appendChild(li);
    }
  } catch {
    list.innerHTML = '<li class="muted">Could not load</li>';
  }
}

function toggleNotif() {
  const p = $('notif-panel');
  if (p.classList.contains('hidden')) {
    p.classList.remove('hidden');
    loadNotifications();
  } else {
    p.classList.add('hidden');
  }
}

function getSavedPlaces() {
  try {
    return JSON.parse(localStorage.getItem('itd_places') || '[]');
  } catch {
    return [];
  }
}

function renderSavedPlaces() {
  const list = $('ac-places-list');
  const places = getSavedPlaces();
  list.innerHTML = '';
  if (!places.length) {
    list.innerHTML = '<li class="muted" style="display:block">No saved places yet</li>';
    return;
  }
  for (const pl of places) {
    const li = document.createElement('li');
    li.innerHTML = `<div><div class="where">${pl.label}</div><div class="when">${pl.address}</div></div>`;
    const del = document.createElement('button');
    del.className = 'icon-btn2';
    del.textContent = '✕';
    del.onclick = () => {
      const cur = getSavedPlaces().filter((x) => x.label !== pl.label || x.address !== pl.address);
      localStorage.setItem('itd_places', JSON.stringify(cur));
      renderSavedPlaces();
    };
    li.appendChild(del);
    list.appendChild(li);
  }
}

function addSavedPlace() {
  const label = $('ac-place-label').value.trim();
  const address = $('ac-place-addr').value.trim();
  if (!label || !address) return toast('Enter label and address');
  const places = getSavedPlaces();
  places.push({ label, address });
  localStorage.setItem('itd_places', JSON.stringify(places));
  $('ac-place-label').value = '';
  $('ac-place-addr').value = '';
  renderSavedPlaces();
  toast('Place saved');
}

function renderReferral() {
  const base = (meId || localStorage.getItem('itd_uid') || $('ac-phone-disp').textContent || 'guest')
    .toString()
    .replace(/\W/g, '')
    .toUpperCase();
  const code = 'ISD-' + base.slice(0, 8);
  $('ac-ref-code').textContent = code;
}

function boot() {
  wireSearch();
  wireAuthTabs();

  $('btn-login').onclick = doLogin;
  $('btn-register').onclick = doRegister;
  $('btn-quick').onclick = doContinue;
  $('in-phone').addEventListener('keydown', (e) => e.key === 'Enter' && doLogin());
  $('in-password').addEventListener('keydown', (e) => e.key === 'Enter' && doLogin());
  $('in-reg-phone').addEventListener('keydown', (e) => e.key === 'Enter' && doRegister());
  $('in-reg-password').addEventListener('keydown', (e) => e.key === 'Enter' && doRegister());
  $('btn-logout').onclick = logout;
  $('btn-estimate').onclick = doEstimate;
  $('btn-book').onclick = doBook;
  $('btn-cancel-ride').onclick = cancelRide;
  $('btn-track-close').onclick = closeTracking;
  $('btn-chat-send').onclick = sendChat;
  $('chat-text').addEventListener('keydown', (e) => e.key === 'Enter' && sendChat());
  $('btn-contact').onclick = maskedCall;
  $('btn-pay').onclick = doPay;
  document.querySelectorAll('.payopt').forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll('.payopt').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      selectedPayMethod = b.dataset.method;
    };
  });
  $('btn-dl-send').onclick = sendDelivery;
  $('btn-locate').onclick = () => {
    if (!map || !window._gps) return;
    map.flyTo({ center: [window._gps.lng, window._gps.lat], zoom: 16, pitch: 50 });
  };
  $('btn-3d').onclick = () => {
    if (!map) return;
    const next = map.getPitch() > 5 ? 0 : 52;
    map.easeTo({ pitch: next, bearing: next ? -18 : 0 });
    $('btn-3d').style.background = next ? 'var(--blue)' : '#fff';
    $('btn-3d').style.color = next ? '#fff' : 'var(--blue)';
  };

  document.querySelectorAll('.bnav').forEach((t) => {
    t.onclick = () => {
      document.querySelectorAll('.bnav').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      const tab = t.dataset.tab;
      $('tab-ride').classList.toggle('hidden', tab !== 'ride');
      $('tab-delivery').classList.toggle('hidden', tab !== 'delivery');
      $('tab-history').classList.toggle('hidden', tab !== 'history');
      $('tab-profile').classList.toggle('hidden', tab !== 'profile');
      if (tab === 'history') loadHistory();
      if (tab === 'delivery') loadDeliveries();
      if (tab === 'profile') loadProfile();
    };
  });

  $('btn-bell').onclick = toggleNotif;
  $('notif-close').onclick = () => $('notif-panel').classList.add('hidden');
  $('btn-account').onclick = openAccount;
  $('ac-back').onclick = () => {
    if ($('ac-menu').classList.contains('hidden')) {
      showAccountSection('menu');
      $('ac-title').textContent = 'Account';
    } else {
      closeAccount();
    }
  };
  document.querySelectorAll('#ac-menu li').forEach((li) => {
    li.onclick = () => showAccountSection(li.dataset.ac);
  });
  $('ac-save-profile').onclick = saveAccountProfile;
  wireAccountAvatar();
  $('ac-topup-btn').onclick = topUpWallet;
  $('ac-toggle-card').onclick = () => $('ac-card-box').classList.toggle('hidden');
  $('ac-card-save').onclick = () => {
    defaultPayMethod = 'card';
    localStorage.setItem('itd_pay', 'card');
    $('ac-pm-current').textContent = 'Card';
    toast('Card saved as payment method');
    $('ac-card-box').classList.add('hidden');
  };
  $('ac-support-send').onclick = () => {
    $('ac-support-msg').value = '';
    toast('Message sent to support');
  };
  $('ac-sos').onclick = () => toast('Emergency alert sent (demo)');
  $('ac-place-add').onclick = addSavedPlace;
  $('ac-ref-copy').onclick = () => {
    const code = $('ac-ref-code').textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
    toast('Referral code copied');
  };
  $('ac-logout').onclick = logout;
  $('ac-pm-current').textContent = defaultPayMethod === 'card' ? 'Card' : defaultPayMethod === 'wallet' ? 'Wallet' : 'Cash';

  $('btn-google').onclick = doGoogleLogin;
  $('btn-email-otp').onclick = () => $('email-otp-box').classList.toggle('hidden');
  $('btn-send-otp').onclick = sendEmailOtp;
  $('btn-verify-otp').onclick = verifyEmailOtp;
  document.querySelectorAll('input[name="regpay"]').forEach((r) => {
    r.onchange = () => {
      $('reg-card-box').classList.toggle('hidden', r.value !== 'card');
    };
  });

  if (token) {
    api('/passengers/wallet')
      .then(() => enterApp())
      .catch(() => {});
  }
}

function loadCss(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve(true);
  return new Promise((resolve) => {
    const sources = [
      '/vendor/maplibre-gl.js',
      'https://cdn.jsdelivr.net/npm/maplibre-gl@4/dist/maplibre-gl.js',
      'https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.js',
      'https://cdn.maplibre.org/maplibre-gl/v4.7.1/maplibre-gl.js',
    ];
    let i = 0;
    const tryNext = () => {
      if (i >= sources.length) return resolve(false);
      const s = document.createElement('script');
      s.src = sources[i++];
      s.onload = () => resolve(window.maplibregl ? true : tryNext());
      s.onerror = () => {
        s.remove();
        tryNext();
      };
      document.head.appendChild(s);
    };
    tryNext();
  });
}

async function bootMap() {
  loadCss('/vendor/maplibre-gl.css');
  const ok = await loadMapLibre();
  if (!ok) {
    toast('Map tiles unavailable - check your connection', 5000);
    return;
  }
  try {
    initMap();
    startGps();
  } catch (e) {
    console.error('map init failed', e);
  }
}

const SPLASH_MS = 4000;
setTimeout(() => {
  const s = $('splash');
  if (s) s.classList.add('fade');
  setTimeout(() => s?.remove(), 600);
}, SPLASH_MS);

try {
  boot();
} catch (e) {
  console.error(e);
}
bootMap();
