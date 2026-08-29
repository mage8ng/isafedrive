'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';
import { api } from '@/lib/api';
import { ErrorBox, PageHeader, Badge } from '@/lib/components';

interface LiveDriver {
  driverId: string;
  userId?: string;
  name: string;
  phone: string;
  lat: number | null;
  lng: number | null;
  online: boolean;
  onTrip: boolean;
  rating: string;
  kycStatus: string;
  vehicle: { make: string; model: string; plate: string; category: string; color: string } | null;
}

interface LiveTrip {
  rideId: string;
  status: string;
  driverUserId?: string;
  driverName: string;
  driverPhone: string;
  vehicle: string;
  plate: string;
  from: [number, number];
  to: [number, number];
  toAddress: string;
  pickupAddress: string;
}

interface OwnPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

interface LeafletBundle {
  L: typeof import('leaflet');
  map: import('leaflet').Map;
}

const routeCache = new Map<string, [number, number][]>();

async function fetchRoadRoute(from: [number, number], to: [number, number]): Promise<[number, number][]> {
  const key = `${from[0].toFixed(4)},${from[1].toFixed(4)}-${to[0].toFixed(4)},${to[1].toFixed(4)}`;
  if (routeCache.has(key)) return routeCache.get(key)!;
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const json = await res.json();
    const coords = json?.routes?.[0]?.geometry?.coordinates;
    if (Array.isArray(coords) && coords.length > 1) {
      const path: [number, number][] = coords.map((c: [number, number]) => [c[1], c[0]]);
      routeCache.set(key, path);
      return path;
    }
  } catch {}
  return [from, to];
}

export default function LiveMapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<LeafletBundle | null>(null);
  const dataLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const ownLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const ownPosRef = useRef<OwnPosition | null>(null);
  const didFocusRef = useRef(false);
  const cabMarkersRef = useRef<Map<string, import('leaflet').Marker>>(new Map());
  const routeLinesRef = useRef<import('leaflet').Polyline[]>([]);
  const animRef = useRef<number | null>(null);
  const tripsRef = useRef<LiveTrip[]>([]);
  const routesRef = useRef<Map<string, [number, number][]>>(new Map());
  const progressRef = useRef<Map<string, number>>(new Map());
  const simRef = useRef(false);

  const [drivers, setDrivers] = useState<LiveDriver[]>([]);
  const [trips, setTrips] = useState<LiveTrip[]>([]);
  const [ownPos, setOwnPos] = useState<OwnPosition | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [geoStatus, setGeoStatus] = useState('Locating you...');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapRef.current || leafletRef.current) return;
      const map = L.map(mapRef.current, { zoomControl: true }).setView([6.5244, 3.3792], 12);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      dataLayerRef.current = L.layerGroup().addTo(map);
      ownLayerRef.current = L.layerGroup().addTo(map);
      leafletRef.current = { L, map };
    })();
    return () => {
      cancelled = true;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('Geolocation not supported by this browser');
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const p = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        ownPosRef.current = p;
        setOwnPos(p);
        setGeoStatus(`Live GPS locked (±${Math.round(pos.coords.accuracy)} m)`);
        const leaflet = leafletRef.current;
        if (leaflet && !didFocusRef.current) {
          didFocusRef.current = true;
          leaflet.map.setView([p.lat, p.lng], 15);
        }
        const { L, map } = leaflet ?? {};
        if (L && map && ownLayerRef.current) {
          ownLayerRef.current.clearLayers();
          L.circle([p.lat, p.lng], {
            radius: Math.max(p.accuracy, 25),
            color: '#1d4ed8',
            weight: 1,
            fillColor: '#1d4ed8',
            fillOpacity: 0.1,
          }).addTo(ownLayerRef.current);
          L.circleMarker([p.lat, p.lng], {
            radius: 8,
            color: '#fff',
            weight: 3,
            fillColor: '#1d4ed8',
            fillOpacity: 1,
          })
            .bindPopup('<b>You are here</b>')
            .addTo(ownLayerRef.current);
        }
      },
      (err) => {
        setGeoStatus(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied - click Allow in your browser to center the map on you'
            : `Location unavailable: ${err.message}`,
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const overview = await api<{ drivers: LiveDriver[]; trips: LiveTrip[] }>(
        '/admin/live/overview',
      );
      setDrivers(overview.drivers);
      setTrips(overview.trips);
      tripsRef.current = overview.trips;

      const leaflet = leafletRef.current;
      if (leaflet) {
        const { L, map } = leaflet;
        for (const line of routeLinesRef.current) line.remove();
        routeLinesRef.current = [];

        const cabIcon = (label: string, onTrip: boolean) =>
          L.divIcon({
            className: '',
            html: `<div style="display:flex;flex-direction:column;align-items:center;gap:1px">
              <div style="background:${onTrip ? '#1d4ed8' : '#16a34a'};color:#fff;border:2px solid #fff;
                border-radius:99px;padding:3px 8px;font-size:10px;font-weight:800;white-space:nowrap;
                box-shadow:0 2px 6px rgba(16,24,40,.35)">${label}</div>
              <div style="font-size:20px;line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,.3))">🚕</div>
            </div>`,
            iconSize: [60, 46],
            iconAnchor: [30, 40],
          });

        for (const d of overview.drivers) {
          if (d.lat == null || d.lng == null) continue;
          const key = d.driverId;
          const label = d.vehicle ? `${d.vehicle.make} ${d.vehicle.model}` : d.name;
          const existing = cabMarkersRef.current.get(key);
          if (existing) {
            existing.setLatLng([d.lat, d.lng]);
            existing.setIcon(cabIcon(label, d.onTrip));
          } else {
            const m = L.marker([d.lat, d.lng], { icon: cabIcon(label, d.onTrip) })
              .bindPopup(
                `<b>${d.name}</b><br/>${d.phone}<br/>` +
                  (d.vehicle
                    ? `${d.vehicle.color ?? ''} ${d.vehicle.make} ${d.vehicle.model}<br/>Plate: ${d.vehicle.plate}<br/>`
                    : '') +
                  `Rating ${d.rating} ★<br/>` +
                  `<a href="/drivers" style="color:#1d4ed8">Manage driver</a>`,
              )
              .addTo(dataLayerRef.current!);
            cabMarkersRef.current.set(key, m);
          }
        }

        for (const trip of overview.trips) {
          const route = await fetchRoadRoute(trip.from, trip.to);
          routesRef.current.set(trip.rideId, route);
          const line = L.polyline(route, {
            color: '#1d4ed8',
            weight: 4,
            opacity: 0.75,
            dashArray: simRef.current ? undefined : '8 10',
          }).addTo(map);
          line.bindPopup(
            `<b>${trip.driverName}</b> · ${trip.vehicle}<br/>Plate: ${trip.plate}<br/>` +
              `${trip.pickupAddress} → ${trip.toAddress}`,
          );
          routeLinesRef.current.push(line);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, []);

  useEffect(() => {
    const start = async () => {
      await new Promise((r) => setTimeout(r, 800));
      loadData();
    };
    start();
    const t = setInterval(loadData, 10000);
    return () => clearInterval(t);
  }, [loadData]);

  useEffect(() => {
    const tick = () => {
      const leaflet = leafletRef.current;
      if (leaflet && simRef.current) {
        const { L, map } = leaflet;
        for (const trip of tripsRef.current) {
          const route = routesRef.current.get(trip.rideId);
          if (!route || route.length < 2) continue;
          const prog = progressRef.current.get(trip.rideId) ?? 0;
          const next = (prog + 0.0025) % 1;
          progressRef.current.set(trip.rideId, next);
          const idx = next * (route.length - 1);
          const i = Math.floor(idx);
          const frac = idx - i;
          const a = route[i];
          const b = route[Math.min(i + 1, route.length - 1)];
          const lat = a[0] + (b[0] - a[0]) * frac;
          const lng = a[1] + (b[1] - a[1]) * frac;
          const marker = cabMarkersRef.current.get(
            drivers.find((d) => d.userId === trip.driverUserId)?.driverId ?? '',
          );
          if (marker) {
            marker.setLatLng([lat, lng]);
            marker.setIcon(
              L.divIcon({
                className: '',
                html: `<div style="display:flex;flex-direction:column;align-items:center">
                  <div style="background:#1d4ed8;color:#fff;border:2px solid #fff;border-radius:99px;
                    padding:3px 8px;font-size:10px;font-weight:800;white-space:nowrap;
                    box-shadow:0 2px 6px rgba(16,24,40,.35)">${trip.vehicle} ${trip.plate}</div>
                  <div style="font-size:20px;line-height:1;transform:rotate(${Math.atan2(
                    b[1] - a[1],
                    b[0] - a[0],
                  )}rad)">🚕</div>
                </div>`,
                iconSize: [60, 46],
                iconAnchor: [30, 40],
              }),
            );
          }
        }
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [drivers]);

  const toggleSimulation = () => {
    const next = !simulating;
    simRef.current = next;
    setSimulating(next);
    const leaflet = leafletRef.current;
    if (leaflet) {
      for (const line of routeLinesRef.current) {
        line.setStyle({ dashArray: next ? undefined : '8 10' });
      }
    }
    if (!next) loadData();
  };

  return (
    <>
      <PageHeader
        title="Live route map"
        subtitle={geoStatus}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge>{drivers.filter((d) => d.online).length} cabs online</Badge>
            <Badge>{trips.length} on trip</Badge>
            <button className="secondary" onClick={toggleSimulation}>
              {simulating ? 'Stop movement sim' : 'Simulate movement'}
            </button>
          </div>
        }
      />
      <ErrorBox message={error} />
      <div
        ref={mapRef}
        style={{ height: 540, borderRadius: 12, border: '1px solid var(--border)' }}
      />
      <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap' }}>
        <span>🚕 Registered cabs (green = available, blue = on trip)</span>
        <span style={{ color: 'var(--accent)' }}>— Solid line: live route · dashed: route idle</span>
      </div>

      <h3 className="section">Registered cabs ({drivers.length})</h3>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6 }}>
        {drivers.map((d) => (
          <li key={d.driverId} className="card" style={{ padding: '10px 14px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18 }}>🚕</span>
            <b>{d.name}</b>
            <span className="muted">{d.phone}</span>
            {d.vehicle && (
              <span>
                {d.vehicle.color} {d.vehicle.make} {d.vehicle.model} · {d.vehicle.plate}
              </span>
            )}
            <Badge>{d.onTrip ? 'on trip' : d.online ? 'available' : 'offline'}</Badge>
            <span className="muted">{d.rating} ★</span>
            <Link href="/drivers" style={{ color: 'var(--accent)', marginLeft: 'auto' }}>
              manage
            </Link>
          </li>
        ))}
        {drivers.length === 0 && <li className="muted">No cabs registered yet.</li>}
      </ul>
    </>
  );
}
