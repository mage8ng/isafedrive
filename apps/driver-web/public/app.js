const API = localStorage.getItem('isafedrive_api') || (window.location.origin + '/api/v1');

let token = sessionStorage.getItem('token') || '';
let map = null;
let meMarker = null;
let routeLayer = null;
let online = false;
let gpsWatch = null;
let lastGps = null;
let activeTrip = null;
let reqTimer = null;
let locTimer = null;
let tripTimer = null;
let lastTripStatus = '';
let lastPaymentStatus = '';
let knownRideIds = new Set();
let notifOpen = false;
let accountWired = false;

const $ = (id) => document.getElementById(id);

function toast(text, ms = 2800) {
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
    pitch: 40,
    attributionControl: false,
  });
}

function boot() {
  wireAuthTabs();
  $('btn-login').onclick = doLogin;
  $('btn-register').onclick = doRegister;
  $('btn-quick').onclick = doContinue;
  $('in-phone').addEventListener('keydown', (e) => e.key === 'Enter' && doLogin());
  $('in-password').addEventListener('keydown', (e) => e.key === 'Enter' && doLogin());
  $('in-reg-phone').addEventListener('keydown', (e) => e.key === 'Enter' && doRegister());
  $('in-reg-password').addEventListener('keydown', (e) => e.key === 'Enter' && doRegister());
  $('btn-logout').onclick = logout;
  $('online-toggle').onclick = toggleOnline;
  $('btn-arrived').onclick = arrive;
  $('btn-start').onclick = startTrip;
  $('btn-complete').onclick = completeTrip;
  $('btn-cancel').onclick = cancelRide;

  $('btn-google').onclick = () => doGoogleLogin();
  $('btn-google-reg').onclick = () => doGoogleLogin();
  $('btn-email-verify-toggle').onclick = () => $('auth-email-verify').classList.toggle('hidden');
  $('btn-send-otp').onclick = sendEmailOtp;
  $('btn-verify-otp').onclick = verifyEmailOtp;

  $('btn-bell').onclick = toggleNotif;
  $('btn-notif-close').onclick = () => { notifOpen = false; $('notif-panel').classList.add('hidden'); };
  $('btn-account').onclick = openAccount;
  $('btn-account-close').onclick = () => $('account-panel').classList.add('hidden');

  $('btn-withdraw').onclick = () => $('withdraw-form').classList.toggle('hidden');
  $('btn-w-submit').onclick = () =>
    doWithdraw($('w-amount').value, $('w-bank').value, $('w-acct').value, $('w-name').value, $('w-msg'));

  if (token) {
    api('/drivers/profile')
      .then(() => enterApp())
      .catch(() => {});
  }
}

function setMeMarker(lat, lng) {
  if (!map) return;
  if (meMarker) {
    meMarker.setLngLat([lng, lat]);
  } else {
    const el = document.createElement('div');
    el.className = 'driver-dot';
    el.innerHTML = '<div class="halo"></div><div class="core"></div>';
    meMarker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
  }
}

function drawTripRoute(from, to) {
  const render = (coords) => {
    if (!map.getSource('trip')) {
      map.addSource('trip', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'trip-line',
        type: 'line',
        source: 'trip',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#b45309', 'line-width': 5, 'line-opacity': 0.85 },
      });
    }
    map.getSource('trip').setData({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: {},
    });
    const bounds = coords.reduce(
      (b, c) => b.extend(c),
      new maplibregl.LngLatBounds(coords[0], coords[0]),
    );
    map.fitBounds(bounds, { padding: 90, maxZoom: 16 });
  };
  let coords = [
    [from.lng, from.lat],
    [to.lng, to.lat],
  ];
  fetch(
    `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`,
    { signal: AbortSignal.timeout(6000) },
  )
    .then((r) => r.json())
    .then((j) => {
      const line = j?.routes?.[0]?.geometry?.coordinates;
      if (Array.isArray(line) && line.length > 1) coords = line;
    })
    .catch(() => {})
    .finally(() => render(coords));
}

function clearRoute() {
  if (map.getSource('trip')) {
    map.getSource('trip').setData({ type: 'FeatureCollection', features: [] });
  }
}

function startGps() {
  if (!('geolocation' in navigator)) return;
  gpsWatch = navigator.geolocation.watchPosition(
    (pos) => {
      lastGps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setMeMarker(lastGps.lat, lastGps.lng);
      $('gps-pill').textContent = `GPS ±${Math.round(pos.coords.accuracy)} m`;
      if (!window._focused) {
        window._focused = true;
        map.flyTo({ center: [lastGps.lng, lastGps.lat], zoom: 15.5, pitch: 40 });
      }
    },
    () => ($('gps-pill').textContent = 'Location permission needed'),
    { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 },
  );
}

async function pushLocation() {
  if (!online || !lastGps) return;
  try {
    await api('/drivers/location', 'PUT', { latitude: lastGps.lat, longitude: lastGps.lng });
  } catch {}
}

function setOnlineUI() {
  const btn = $('online-toggle');
  btn.textContent = online ? 'YOU ARE ONLINE' : 'GO ONLINE';
  btn.classList.toggle('off', !online);
  btn.style.background = online ? '#98a2b3' : 'var(--green)';
}

async function toggleOnline() {
  if (!lastGps) return toast('Waiting for GPS lock...');
  try {
    const res = await api(online ? '/drivers/go-offline' : '/drivers/go-online', 'POST',
      online ? {} : { latitude: lastGps.lat, longitude: lastGps.lng });
    online = res.onlineStatus === 'online';
    setOnlineUI();
    toast(online ? 'You are online - ride requests incoming' : 'You are offline');
    clearInterval(locTimer);
    if (online) {
      pushLocation();
      locTimer = setInterval(pushLocation, 5000);
      loadRequests();
    } else {
      clearRequests();
      if (activeTrip) refreshTrip();
    }
  } catch (err) {
    toast(err.message);
  }
}

async function loadEarnings() {
  try {
    const e = await api('/drivers/earnings');
    const today = `₦${Number(e.today ?? 0).toLocaleString()}`;
    const rating = `${e.statistics?.averageRating ?? '-'} ★`;
    const trips = e.statistics?.completedRides ?? 0;
    $('earn-today').textContent = today;
    $('earn-rating').textContent = rating;
    $('earn-trips').textContent = trips;
    $('earn-today-2').textContent = today;
    $('earn-rating-2').textContent = rating;
    $('earn-trips-2').textContent = trips;
  } catch {}
}

function wireDriverTabs() {
  document.querySelectorAll('.bnav').forEach((t) => {
    t.onclick = () => {
      document.querySelectorAll('.bnav').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      const tab = t.dataset.dtab;
      $('tab-driver-requests').classList.toggle('hidden', tab !== 'requests');
      $('tab-driver-trip').classList.toggle('hidden', tab !== 'trip');
      $('tab-driver-earn').classList.toggle('hidden', tab !== 'earn');
      $('tab-driver-profile').classList.toggle('hidden', tab !== 'profile');
      if (tab === 'trip') refreshTrip();
      if (tab === 'earn') { loadEarnings(); loadWallet(); }
      if (tab === 'profile') loadProfile();
    };
  });
  // Default active tab is Requests
  document.querySelectorAll('.bnav').forEach((x) =>
    x.classList.toggle('active', x.dataset.dtab === 'requests'));
  $('tab-driver-requests').classList.remove('hidden');
  $('tab-driver-trip').classList.add('hidden');
  $('tab-driver-earn').classList.add('hidden');
  $('tab-driver-profile').classList.add('hidden');
}

function renderRequest(r) {
  const li = document.createElement('li');
  li.innerHTML =
    `<div class="req-top"><b>${r.pickupAddress}</b>` +
    `<span class="fare">₦${Number(r.fare).toLocaleString()}</span></div>` +
    `<div class="muted small">→ ${r.destinationAddress}</div>` +
    `<div class="muted small">${Number(r.distanceKm).toFixed(1)} km · ${r.passenger?.fullName ?? 'Rider'} (${r.passenger?.rating ?? '-'} ★)</div>`;
  const btn = document.createElement('button');
  btn.className = 'primary full';
  btn.style.marginTop = '8px';
  btn.textContent = `Accept ride`;
  btn.onclick = () => acceptRide(r.id);
  li.appendChild(btn);
  return li;
}

async function loadRequests() {
  if (activeTrip) return;
  try {
    const rides = await api('/drivers/available-rides');
    const list = $('requests-list');
    list.innerHTML = '';
    if (!rides.length) {
      list.innerHTML = '<li class="muted" style="display:block">No requests right now. Stay online near riders.</li>';
      knownRideIds = new Set();
      return;
    }
    const ids = new Set(rides.map((r) => r.id));
    if (knownRideIds.size > 0) {
      for (const r of rides) {
        if (!knownRideIds.has(r.id)) toast('New ride request nearby');
      }
    }
    knownRideIds = ids;
    for (const r of rides.slice(0, 5)) list.appendChild(renderRequest(r));
  } catch {}
}

function clearRequests() {
  $('requests-list').innerHTML =
    '<li class="muted" style="display:block">Go online to receive ride requests.</li>';
}

async function acceptRide(rideId) {
  try {
    await api(`/rides/${rideId}/accept`, 'POST');
    activeTrip = rideId;
    lastTripStatus = 'driver_assigned';
    lastPaymentStatus = '';
    toast('Ride accepted!');
    clearInterval(reqTimer);
    clearInterval(tripTimer);
    tripTimer = setInterval(refreshTrip, 5000);
    refreshTrip();
  } catch (err) {
    toast(err.message);
    loadRequests();
  }
}

async function refreshTrip() {
  if (!activeTrip) return;
  try {
    const t = await api(`/rides/${activeTrip}/tracking`);
    if (['completed', 'cancelled'].includes(t.status)) {
      toast(`Trip ${t.status}`);
      endTrip();
      return;
    }
    if (!t.passenger) {
      activeTrip = null;
      showDashboard();
      loadRequests();
      return;
    }
    $('dash').classList.remove('hidden');
    $('no-trip').classList.add('hidden');
    $('requests-box').classList.add('hidden');
    $('trip-box').classList.remove('hidden');
    $('trip-empty').classList.add('hidden');

    $('trip-passenger').innerHTML =
      `👤 ${t.passenger.name ?? 'Rider'} <span class="muted small">(${t.passenger.rating} ★) · ${t.passenger.phone}</span>`;
    $('trip-route').innerHTML =
      `<b>${t.pickup.address}</b> → ${t.destination.address}<br/>` +
      `<span class="badge">${t.status.replaceAll('_', ' ')}</span> ₦${Number(t.fare).toLocaleString()} · PIN required at start`;

    const arrived = ['driver_arrived'].includes(t.status);
    const assigned = t.status === 'driver_assigned';
    $('btn-arrived').classList.toggle('hidden', !assigned);
    $('pin-row').classList.toggle('hidden', !arrived);
    $('btn-complete').classList.toggle('hidden', !arrived);

    // Payment status display + change toasts
    const pay = t.paymentStatus || 'pending';
    const method = (t.paymentMethod || 'cash').toUpperCase();
    const payEl = $('trip-payment');
    if (pay === 'paid') {
      payEl.textContent = `Payment: ₦${Number(t.fare).toLocaleString()} via ${method} — received`;
      payEl.classList.remove('hidden');
    } else {
      payEl.textContent = `Payment: ₦${Number(t.fare).toLocaleString()} via ${method} (pending)`;
      payEl.classList.remove('hidden');
    }
    if (pay === 'paid' && lastPaymentStatus !== 'paid') toast('Payment received');
    lastPaymentStatus = pay;

    // Status-change toasts
    if (lastTripStatus && lastTripStatus !== t.status) {
      const map = {
        driver_assigned: 'Ride accepted by you',
        driver_arrived: 'You have arrived',
        in_progress: 'Trip started',
        completed: 'Trip completed',
        cancelled: 'Trip cancelled',
      };
      if (map[t.status]) toast(map[t.status]);
    }
    lastTripStatus = t.status;

    if (t.pickup && t.destination) {
      drawTripRoute({ lat: t.pickup.lat, lng: t.pickup.lng }, { lat: t.destination.lat, lng: t.destination.lng });
    }
    loadChat();
  } catch {}
}

function endTrip() {
  activeTrip = null;
  clearInterval(tripTimer);
  lastTripStatus = '';
  lastPaymentStatus = '';
  clearRoute();
  showDashboard();
  loadEarnings();
  $('trip-box').classList.add('hidden');
  $('trip-empty').classList.remove('hidden');
}

async function loadChat() {
  if (!activeTrip) return;
  try {
    const messages = await api(`/rides/${activeTrip}/messages`);
    const log = $('chat-log');
    log.innerHTML = messages.length
      ? messages.map((m) => `<div class="chat-msg"><b>${m.sender?.phone ?? ''}</b>: ${m.text}</div>`).join('')
      : '<span class="muted small">No messages yet</span>';
    log.scrollTop = log.scrollHeight;
  } catch {}
}

async function sendChat() {
  const text = $('chat-text').value.trim();
  if (!text || !activeTrip) return;
  $('chat-text').value = '';
  try {
    await api(`/rides/${activeTrip}/messages`, 'POST', { text });
    loadChat();
  } catch (err) {
    toast(err.message);
  }
}

async function loadProfile() {
  try {
    const { user, driver } = await api('/drivers/profile');
    $('profile-name').textContent = user.fullName ?? 'Driver';
    $('profile-phone').textContent = user.phone;
    const veh = localStorage.getItem('isafedrive_vehicle');
    $('profile-vehicle').textContent = veh
      ? `Vehicle: ${veh} · KYC ${driver.kycStatus}`
      : `${driver.onlineStatus} · KYC ${driver.kycStatus}`;
    $('pf-name').value = user.fullName ?? '';
    $('pf-email').value = user.email ?? '';
    if (user.profilePhoto) {
      $('avatar-img').src = user.profilePhoto;
      $('avatar-img').classList.remove('hidden');
      $('avatar-fallback').classList.add('hidden');
    } else {
      $('avatar-fallback').textContent = (user.fullName ?? 'D')[0].toUpperCase();
    }
  } catch {}
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
    await api('/drivers/profile', 'PUT', {
      fullName: $('pf-name').value.trim(),
      email: $('pf-email').value.trim() || undefined,
    });
    toast('Profile saved');
    $('pf-msg').textContent = '';
    loadProfile();
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
        const res = await api('/drivers/profile', 'PUT', { profilePhoto: dataUrl });
        $('avatar-img').src = res.user.profilePhoto;
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
  $('btn-chat-send').onclick = sendChat;
  $('chat-text').addEventListener('keydown', (e) => e.key === 'Enter' && sendChat());
}

function showDashboard() {
  $('trip-box').classList.add('hidden');
  $('no-trip').classList.remove('hidden');
  $('requests-box').classList.remove('hidden');
  reqTimer = setInterval(loadRequests, 5000);
  loadRequests();
}

async function arrive() {
  try {
    await api(`/rides/${activeTrip}/arrived`, 'POST');
    toast('Marked as arrived - ask for the PIN');
    refreshTrip();
  } catch (err) {
    toast(err.message);
  }
}

async function startTrip() {
  const pin = $('in-pin').value.trim();
  if (pin.length !== 4) return toast('Enter the 4-digit rider PIN');
  try {
    await api(`/rides/${activeTrip}/start`, 'POST', { pin });
    toast('Trip started');
    $('in-pin').value = '';
    refreshTrip();
  } catch (err) {
    toast(err.message);
  }
}

async function completeTrip() {
  try {
    const ride = await api(`/rides/${activeTrip}/complete`, 'POST');
    toast(`Trip completed - earned ₦${Number(ride.fare).toLocaleString()}`);
    endTrip();
  } catch (err) {
    toast(err.message);
  }
}

async function doContinue() {
  const phone = $('in-phone').value.trim();
  if (!phone) return toast('Enter your phone number');
  const btn = $('btn-quick');
  btn.disabled = true;
  try {
    const vehicle = $('in-vehicle').value.trim();
    const res = await api('/auth/quick-login', 'POST', {
      phone,
      fullName: $('in-name').value.trim() || undefined,
      role: 'driver',
    });
    token = res.accessToken;
    sessionStorage.setItem('token', token);
    await ensureDriver(vehicle);
    enterApp();
  } catch (err) {
    $('auth-msg').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

async function ensureDriver(vehicle) {
  try {
    await api('/drivers/profile');
  } catch {
    await api('/drivers/profile', 'POST');
  }
  if (vehicle) {
    const categoryId = $('in-category').value;
    const make = vehicle.split(' ')[0] ?? vehicle;
    const model = vehicle.split(' ').slice(1).join(' ') || vehicle;
    const plateNumber = `ISD-${Math.floor(1000 + Math.random() * 9000)}`;
    await api('/drivers/vehicles', 'POST', {
      categoryId,
      make,
      model,
      year: 2020,
      color: 'Any',
      plateNumber,
    }).catch(() => {});
    localStorage.setItem('isafedrive_vehicle', `${make} ${model} · ${plateNumber}`);
    const pay = document.querySelector('input[name="paymethod"]:checked');
    if (pay) localStorage.setItem('isafedrive_paymethod', pay.value);
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
    token = res.accessToken;
    sessionStorage.setItem('token', token);
    await ensureDriver();
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
  const vehicle = $('in-vehicle').value.trim();
  const btn = $('btn-register');
  btn.disabled = true;
  try {
    await api('/auth/register', 'POST', { fullName, phone, password, role: 'driver' });
    const res = await api('/auth/login', 'POST', { phone, password });
    token = res.accessToken;
    sessionStorage.setItem('token', token);
    await ensureDriver(vehicle);
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

function enterApp() {
  $('view-auth').classList.add('hidden');
  $('dash').classList.remove('hidden');
  $('btn-logout').classList.remove('hidden');
  wireDriverTabs();
  wireProfile();
  loadProfile();
  loadWallet();
  loadEarnings().then(async () => {
    try {
      const profile = await api('/drivers/profile');
      online = profile.driver.onlineStatus === 'online';
      setOnlineUI();
      if (online) {
        locTimer = setInterval(pushLocation, 5000);
        showDashboard();
      } else {
        clearRequests();
      }
    } catch {}
  });
  showOnlineState();
}

function showOnlineState() {
  if (online) showDashboard();
  else clearRequests();
}

function logout() {
  clearInterval(reqTimer);
  clearInterval(locTimer);
  navigator.geolocation?.clearWatch(gpsWatch);
  token = '';
  sessionStorage.removeItem('token');
  location.reload();
}

function loadCss(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

/* ============ Wallet ============ */
async function loadWallet() {
  try {
    const w = await api('/drivers/wallet');
    const bal = `₦${Number(w.balance ?? 0).toLocaleString()}`;
    if ($('wallet-balance')) $('wallet-balance').textContent = bal;
    if ($('acct-wallet-balance')) $('acct-wallet-balance').textContent = bal;
  } catch {}
}

async function doWithdraw(amount, bank, acct, name, msgEl) {
  amount = Number(amount);
  if (!amount || amount < 100) return toast('Minimum withdrawal is ₦100');
  if (!bank || !acct || !name) return toast('Fill all withdrawal fields');
  try {
    await api('/drivers/withdraw', 'POST', {
      amount,
      bankName: bank,
      accountNumber: acct,
      accountName: name,
    });
    toast('Withdrawal requested');
    if (msgEl) msgEl.textContent = 'Withdrawal requested';
    loadWallet();
  } catch (e) {
    toast(e.message);
    if (msgEl) msgEl.textContent = e.message;
  }
}

/* ============ Notifications ============ */
function fmtTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

async function loadNotifications() {
  try {
    const list = await api('/notifications');
    const ul = $('notif-list');
    if (!list.length) {
      ul.innerHTML = '<li class="muted">No notifications</li>';
      return;
    }
    ul.innerHTML = '';
    for (const n of list.slice(0, 25)) {
      const li = document.createElement('li');
      li.innerHTML =
        `<b>${n.title ?? ''}</b>` +
        `<div class="muted small">${n.message ?? ''}</div>` +
        `<div class="muted small">${fmtTime(n.createdAt)}</div>`;
      ul.appendChild(li);
    }
  } catch {}
}

function toggleNotif() {
  notifOpen = !notifOpen;
  $('notif-panel').classList.toggle('hidden', !notifOpen);
  if (notifOpen) loadNotifications();
}

/* ============ Account panel ============ */
async function openAccount() {
  $('account-panel').classList.remove('hidden');
  if (!accountWired) {
    wireAccountPanel();
    accountWired = true;
  }
  loadProfileAcct();
  loadWallet();
  loadSavedPlaces();
}

function wireAccountPanel() {
  document.querySelectorAll('.acct-tab').forEach((t) => {
    t.onclick = () => {
      document.querySelectorAll('.acct-tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      const a = t.dataset.act;
      ['profile', 'payment', 'support', 'safety', 'saved', 'settings', 'earn'].forEach((s) =>
        $(`acct-${s}`).classList.toggle('hidden', s !== a));
    };
  });

  $('acct-save-profile').onclick = saveProfileAcct;
  $('acct-avatar-btn').onclick = () => $('acct-avatar').click();
  $('acct-avatar').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    resizeImage(file, 512, async (dataUrl) => {
      try {
        const res = await api('/drivers/profile', 'PUT', { profilePhoto: dataUrl });
        const src = res.user?.profilePhoto || dataUrl;
        $('acct-avatar-img').src = src;
        $('acct-avatar-img').classList.remove('hidden');
        $('acct-avatar-fallback').classList.add('hidden');
        $('avatar-img').src = src;
        $('avatar-img').classList.remove('hidden');
        $('avatar-fallback').classList.add('hidden');
        toast('Photo updated');
      } catch (err) {
        toast(err.message);
      }
    });
    e.target.value = '';
  };

  $('acct-w-submit').onclick = () =>
    doWithdraw($('acct-w-amount').value, $('acct-w-bank').value, $('acct-w-acct').value, $('acct-w-name').value, $('acct-w-msg'));

  $('btn-saved-add').onclick = () => {
    const v = $('saved-input').value.trim();
    if (!v) return toast('Enter a place');
    const places = JSON.parse(localStorage.getItem('isafedrive_places') || '[]');
    places.push(v);
    localStorage.setItem('isafedrive_places', JSON.stringify(places));
    $('saved-input').value = '';
    loadSavedPlaces();
  };

  $('btn-support-send').onclick = () => {
    if (!$('support-msg').value.trim()) return toast('Type a message');
    toast('Support message sent');
    $('support-msg').value = '';
  };

  $('btn-sos').onclick = async () => {
    if (!confirm('Send SOS emergency alert with your location?')) return;
    try {
      await api('/safety/sos', 'POST', { reason: 'driver-emergency' });
      toast('SOS sent — help is on the way');
    } catch (e) {
      toast(e.message);
    }
  };

  $('btn-logout-2').onclick = logout;
  $('btn-earn-copy').onclick = () => {
    const code = $('earn-code').value;
    if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
    toast('Referral code copied');
  };

  $('set-notif').onchange = (e) => localStorage.setItem('isafedrive_set_notif', e.target.checked);
  $('set-sound').onchange = (e) => localStorage.setItem('isafedrive_set_sound', e.target.checked);
  $('set-auto').onchange = (e) => localStorage.setItem('isafedrive_set_auto', e.target.checked);
}

async function loadProfileAcct() {
  try {
    const { user, driver } = await api('/drivers/profile');
    $('acct-name').value = user.fullName ?? '';
    $('acct-email').value = user.email ?? '';
    $('acct-name-display').textContent = user.fullName ?? 'Driver';
    $('acct-phone-display').textContent = user.phone ?? '';
    const veh = localStorage.getItem('isafedrive_vehicle');
    $('acct-vehicle-display').textContent = veh
      ? `Vehicle: ${veh}`
      : `${driver.onlineStatus} · KYC ${driver.kycStatus}`;
    $('earn-code').value = user.referralCode ?? user.referral ?? 'ISD-DRIVER';
    if (user.profilePhoto) {
      $('acct-avatar-img').src = user.profilePhoto;
      $('acct-avatar-img').classList.remove('hidden');
      $('acct-avatar-fallback').classList.add('hidden');
    } else {
      $('acct-avatar-fallback').textContent = (user.fullName ?? 'D')[0].toUpperCase();
    }
  } catch {}
}

async function saveProfileAcct() {
  try {
    await api('/drivers/profile', 'PUT', {
      fullName: $('acct-name').value.trim(),
      email: $('acct-email').value.trim() || undefined,
    });
    toast('Profile saved');
    $('acct-pf-msg').textContent = '';
    loadProfileAcct();
    loadProfile();
  } catch (err) {
    $('acct-pf-msg').textContent = err.message;
  }
}

function loadSavedPlaces() {
  const places = JSON.parse(localStorage.getItem('isafedrive_places') || '[]');
  const ul = $('saved-list');
  ul.innerHTML = places.length ? '' : '<li class="muted">No saved places yet</li>';
  places.forEach((p, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<div>${p}</div>`;
    const b = document.createElement('button');
    b.className = 'x';
    b.textContent = '✕';
    b.onclick = () => {
      places.splice(i, 1);
      localStorage.setItem('isafedrive_places', JSON.stringify(places));
      loadSavedPlaces();
    };
    li.appendChild(b);
    ul.appendChild(li);
  });
}

/* ============ Cancel ride ============ */
async function cancelRide() {
  if (!activeTrip) return;
  if (!confirm('Cancel this ride?')) return;
  try {
    await api(`/rides/${activeTrip}/cancel`, 'POST');
    toast('Ride cancelled');
    endTrip();
  } catch (err) {
    toast(err.message);
  }
}

/* ============ Social login + email verification ============ */
async function doGoogleLogin() {
  if (!window.GOOGLE_CLIENT_ID) {
    toast('Google sign-in is not configured');
    return;
  }
  try {
    const { google } = window;
    if (!google?.accounts?.id) return toast('Google sign-in is not configured');
    google.accounts.id.initialize({
      client_id: window.GOOGLE_CLIENT_ID,
      callback: async (resp) => {
        try {
          const res = await api('/auth/google', 'POST', { idToken: resp.credential, role: 'driver' });
          token = res.accessToken;
          sessionStorage.setItem('token', token);
          await ensureDriver();
          enterApp();
        } catch (e) {
          $('auth-msg').textContent = e.message;
        }
      },
    });
    google.accounts.id.prompt();
  } catch (e) {
    toast('Google sign-in failed');
  }
}

async function sendEmailOtp() {
  const email = $('in-verify-email').value.trim();
  if (!email) return toast('Enter your email');
  try {
    await api('/auth/send-email-otp', 'POST', { email });
    toast('OTP sent to your email (check server logs in dev)');
  } catch (e) {
    $('auth-msg').textContent = e.message;
  }
}

async function verifyEmailOtp() {
  const email = $('in-verify-email').value.trim();
  const code = $('in-verify-code').value.trim();
  if (!email || !code) return toast('Enter email and code');
  try {
    const res = await api('/auth/verify-email-otp', 'POST', { email, code });
    token = res.accessToken;
    sessionStorage.setItem('token', token);
    await ensureDriver();
    enterApp();
  } catch (e) {
    $('auth-msg').textContent = e.message;
  }
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
