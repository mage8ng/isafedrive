'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ErrorBox, PageHeader, Table, Badge } from '@/lib/components';

interface CityRow extends Record<string, unknown> {
  id: string;
  name: string;
  state: string;
  country: string;
  currency: string;
  active: boolean;
}

interface ZoneRow extends Record<string, unknown> {
  id: string;
  name: string;
  type: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusKm: number;
  fareMultiplier: string;
  surgeMultiplier: string;
  active: boolean;
  city?: { name: string };
}

export default function CitiesPage() {
  const [cities, setCities] = useState<CityRow[]>([]);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [error, setError] = useState('');
  const [cityForm, setCityForm] = useState({ name: '', state: '' });
  const [zoneForm, setZoneForm] = useState({
    cityId: '',
    name: '',
    type: 'standard',
    centerLatitude: 6.5244,
    centerLongitude: 3.3792,
    radiusKm: 5,
    fareMultiplier: 1,
    surgeMultiplier: 1,
  });

  const load = useCallback(async () => {
    try {
      const [c, z] = await Promise.all([
        api<CityRow[]>('/cities'),
        api<ZoneRow[]>('/admin/zones'),
      ]);
      setCities(c);
      setZones(z);
      setZoneForm((f) => ({ ...f, cityId: f.cityId || c[0]?.id || '' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Cities & zones"
        subtitle="Geofenced service areas - restricted zones block pickups, airport/surge zones adjust pricing"
      />
      <ErrorBox message={error} />

      <h3 className="section">Cities ({cities.length})</h3>
      <form
        className="card inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          await api('/admin/cities', {
            method: 'POST',
            body: JSON.stringify(cityForm),
          });
          setCityForm({ name: '', state: '' });
          load();
        }}
      >
        <input
          placeholder="City name"
          value={cityForm.name}
          onChange={(e) => setCityForm({ ...cityForm, name: e.target.value })}
          required
        />
        <input
          placeholder="State"
          value={cityForm.state}
          onChange={(e) => setCityForm({ ...cityForm, state: e.target.value })}
          required
        />
        <button className="primary" type="submit">
          Add city
        </button>
      </form>
      <Table<CityRow>
        rowKey={(r) => r.id}
        columns={[
          { key: 'name', label: 'City', render: (r) => <b>{r.name}</b> },
          { key: 'state', label: 'State' },
          { key: 'country', label: 'Country' },
          { key: 'currency', label: 'Currency' },
          { key: 'active', label: 'Active', render: (r) => (r.active ? 'yes' : 'no') },
        ]}
        rows={cities}
      />

      <h3 className="section">Zones ({zones.length})</h3>
      <form
        className="card inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          await api('/admin/zones', {
            method: 'POST',
            body: JSON.stringify({
              ...zoneForm,
              fareMultiplier: Number(zoneForm.fareMultiplier),
              surgeMultiplier: Number(zoneForm.surgeMultiplier),
              radiusKm: Number(zoneForm.radiusKm),
              city: { id: zoneForm.cityId },
            }),
          });
          load();
        }}
      >
        <select
          value={zoneForm.cityId}
          onChange={(e) => setZoneForm({ ...zoneForm, cityId: e.target.value })}
        >
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          placeholder="Zone name"
          value={zoneForm.name}
          onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
          required
        />
        <select
          value={zoneForm.type}
          onChange={(e) => setZoneForm({ ...zoneForm, type: e.target.value })}
        >
          <option value="standard">standard</option>
          <option value="airport">airport</option>
          <option value="surge">surge</option>
          <option value="restricted">restricted</option>
        </select>
        <input
          type="number"
          step="any"
          value={zoneForm.centerLatitude}
          onChange={(e) => setZoneForm({ ...zoneForm, centerLatitude: Number(e.target.value) })}
          title="Center latitude"
        />
        <input
          type="number"
          step="any"
          value={zoneForm.centerLongitude}
          onChange={(e) => setZoneForm({ ...zoneForm, centerLongitude: Number(e.target.value) })}
          title="Center longitude"
        />
        <input
          type="number"
          value={zoneForm.radiusKm}
          onChange={(e) => setZoneForm({ ...zoneForm, radiusKm: Number(e.target.value) })}
          title="Radius km"
          style={{ width: 90 }}
        />
        <button className="primary" type="submit">
          Add zone
        </button>
      </form>
      <Table<ZoneRow>
        rowKey={(r) => r.id}
        columns={[
          { key: 'name', label: 'Zone', render: (r) => <b>{r.name}</b> },
          { key: 'city', label: 'City', render: (r) => r.city?.name ?? '-' },
          { key: 'type', label: 'Type', render: (r) => <Badge>{r.type}</Badge> },
          {
            key: 'center',
            label: 'Center',
            render: (r) => `${r.centerLatitude.toFixed(4)}, ${r.centerLongitude.toFixed(4)}`,
          },
          { key: 'radius', label: 'Radius', render: (r) => `${r.radiusKm} km` },
          { key: 'fare', label: 'Fare ×', render: (r) => `${r.fareMultiplier}×` },
          { key: 'surge', label: 'Surge ×', render: (r) => `${r.surgeMultiplier}×` },
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <button
                className="secondary"
                onClick={async () => {
                  await api(`/admin/zones/${r.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ active: !r.active }),
                  });
                  load();
                }}
              >
                {r.active ? 'Disable' : 'Enable'}
              </button>
            ),
          },
        ]}
        rows={zones}
      />
    </>
  );
}
