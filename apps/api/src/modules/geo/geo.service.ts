import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { haversineKm } from '@isafedrive/shared';
import { City } from './city.entity';
import { Zone, ZoneType } from './zone.entity';

@Injectable()
export class GeoService implements OnModuleInit {
  constructor(
    @InjectRepository(City)
    private citiesRepository: Repository<City>,
    @InjectRepository(Zone)
    private zonesRepository: Repository<Zone>,
  ) {}

  async onModuleInit() {
    await this.ensureSeeded();
  }

  private static readonly NIGERIA_SEED: {
    name: string;
    state: string;
    lat: number;
    lng: number;
    radiusKm: number;
    zones: {
      name: string;
      type: ZoneType;
      lat: number;
      lng: number;
      radiusKm: number;
      fareMultiplier?: number;
      surgeMultiplier?: number;
    }[];
  }[] = [
    {
      name: 'Lagos', state: 'Lagos', lat: 6.5244, lng: 3.3792, radiusKm: 30,
      zones: [
        { name: 'Lagos Metro', type: 'standard', lat: 6.5244, lng: 3.3792, radiusKm: 30 },
        { name: 'Murtala Muhammed Airport', type: 'airport', lat: 6.5774, lng: 3.3212, radiusKm: 5, fareMultiplier: 1.1 },
        { name: 'Victoria Island Surge', type: 'surge', lat: 6.4281, lng: 3.4219, radiusKm: 6, surgeMultiplier: 1.3 },
        { name: 'Apapa Port Restricted', type: 'restricted', lat: 6.4489, lng: 3.3594, radiusKm: 3 },
        { name: 'Ikeja Surge', type: 'surge', lat: 6.6018, lng: 3.3515, radiusKm: 5, surgeMultiplier: 1.2 },
      ],
    },
    {
      name: 'Abuja', state: 'FCT', lat: 9.0765, lng: 7.3986, radiusKm: 25,
      zones: [
        { name: 'Abuja Central', type: 'standard', lat: 9.0765, lng: 7.3986, radiusKm: 25 },
        { name: 'Nnamdi Azikiwe Airport', type: 'airport', lat: 9.0068, lng: 7.2632, radiusKm: 5, fareMultiplier: 1.1 },
        { name: 'Central Business District Surge', type: 'surge', lat: 9.0489, lng: 7.4895, radiusKm: 4, surgeMultiplier: 1.25 },
      ],
    },
    {
      name: 'Port Harcourt', state: 'Rivers', lat: 4.8156, lng: 7.0498, radiusKm: 22,
      zones: [
        { name: 'Port Harcourt Metro', type: 'standard', lat: 4.8156, lng: 7.0498, radiusKm: 22 },
        { name: 'Port Harcourt Intl Airport', type: 'airport', lat: 5.016, lng: 6.9496, radiusKm: 5, fareMultiplier: 1.1 },
        { name: 'Trans-Amadi Industrial', type: 'surge', lat: 4.8296, lng: 7.0498, radiusKm: 4, surgeMultiplier: 1.2 },
      ],
    },
    {
      name: 'Ibadan', state: 'Oyo', lat: 7.3775, lng: 3.947, radiusKm: 20,
      zones: [
        { name: 'Ibadan Metro', type: 'standard', lat: 7.3775, lng: 3.947, radiusKm: 20 },
        { name: 'Bodija Surge', type: 'surge', lat: 7.4269, lng: 3.9087, radiusKm: 4, surgeMultiplier: 1.2 },
      ],
    },
    {
      name: 'Kano', state: 'Kano', lat: 12.0022, lng: 8.592, radiusKm: 22,
      zones: [
        { name: 'Kano Metro', type: 'standard', lat: 12.0022, lng: 8.592, radiusKm: 22 },
        { name: 'Mallam Aminu Kano Airport', type: 'airport', lat: 12.0476, lng: 8.5244, radiusKm: 5, fareMultiplier: 1.1 },
      ],
    },
    {
      name: 'Benin City', state: 'Edo', lat: 6.335, lng: 5.6037, radiusKm: 18,
      zones: [{ name: 'Benin Metro', type: 'standard', lat: 6.335, lng: 5.6037, radiusKm: 18 }],
    },
    {
      name: 'Enugu', state: 'Enugu', lat: 6.5244, lng: 7.4951, radiusKm: 15,
      zones: [
        { name: 'Enugu Metro', type: 'standard', lat: 6.5244, lng: 7.4951, radiusKm: 15 },
        { name: 'Akanu Ibiam Airport', type: 'airport', lat: 6.4726, lng: 7.5564, radiusKm: 4, fareMultiplier: 1.1 },
      ],
    },
    {
      name: 'Kaduna', state: 'Kaduna', lat: 10.5222, lng: 7.4383, radiusKm: 18,
      zones: [
        { name: 'Kaduna Metro', type: 'standard', lat: 10.5222, lng: 7.4383, radiusKm: 18 },
        { name: 'Kaduna Airport', type: 'airport', lat: 10.6969, lng: 7.3106, radiusKm: 4, fareMultiplier: 1.1 },
      ],
    },
    {
      name: 'Aba', state: 'Abia', lat: 5.1066, lng: 7.3667, radiusKm: 12,
      zones: [{ name: 'Aba Metro', type: 'standard', lat: 5.1066, lng: 7.3667, radiusKm: 12 }],
    },
    {
      name: 'Uyo', state: 'Akwa Ibom', lat: 5.0333, lng: 7.9333, radiusKm: 14,
      zones: [
        { name: 'Uyo Metro', type: 'standard', lat: 5.0333, lng: 7.9333, radiusKm: 14 },
        { name: 'Victor Attah Airport', type: 'airport', lat: 4.9062, lng: 7.9333, radiusKm: 4, fareMultiplier: 1.1 },
      ],
    },
    {
      name: 'Jos', state: 'Plateau', lat: 9.8965, lng: 8.8583, radiusKm: 15,
      zones: [{ name: 'Jos Metro', type: 'standard', lat: 9.8965, lng: 8.8583, radiusKm: 15 }],
    },
    {
      name: 'Onitsha', state: 'Anambra', lat: 6.1414, lng: 6.8022, radiusKm: 12,
      zones: [{ name: 'Onitsha Metro', type: 'standard', lat: 6.1414, lng: 6.8022, radiusKm: 12 }],
    },
    {
      name: 'Warri', state: 'Delta', lat: 5.5167, lng: 5.75, radiusKm: 12,
      zones: [{ name: 'Warri Metro', type: 'standard', lat: 5.5167, lng: 5.75, radiusKm: 12 }],
    },
  ];

  private async ensureSeeded() {
    for (const citySeed of GeoService.NIGERIA_SEED) {
      let city = await this.citiesRepository.findOne({ where: { name: citySeed.name } });
      if (!city) {
        city = await this.citiesRepository.save(
          this.citiesRepository.create({
            name: citySeed.name,
            state: citySeed.state,
            currency: 'NGN',
          }),
        );
      }
      for (const zoneSeed of citySeed.zones) {
        const existing = await this.zonesRepository.findOne({
          where: { name: zoneSeed.name, city: { id: city.id } },
        });
        if (existing) continue;
        await this.zonesRepository.save(
          this.zonesRepository.create({
            city,
            name: zoneSeed.name,
            type: zoneSeed.type,
            centerLatitude: zoneSeed.lat,
            centerLongitude: zoneSeed.lng,
            radiusKm: zoneSeed.radiusKm,
            fareMultiplier: zoneSeed.fareMultiplier ?? 1,
            surgeMultiplier: zoneSeed.surgeMultiplier ?? 1,
          }),
        );
      }
    }
  }

  listCities(): Promise<City[]> {
    return this.citiesRepository.find({ order: { name: 'ASC' } });
  }

  async createCity(data: Partial<City>): Promise<City> {
    return this.citiesRepository.save(this.citiesRepository.create(data));
  }

  listZones(cityId?: string): Promise<Zone[]> {
    const qb = this.zonesRepository
      .createQueryBuilder('zone')
      .leftJoinAndSelect('zone.city', 'city')
      .orderBy('zone.name', 'ASC');
    if (cityId) qb.where('zone.city.id = :cityId', { cityId });
    return qb.getMany();
  }

  async createZone(data: Partial<Zone>): Promise<Zone> {
    if (!data.city?.id) throw new NotFoundException('City required');
    const city = await this.citiesRepository.findOne({ where: { id: data.city.id } });
    if (!city) throw new NotFoundException('City not found');
    return this.zonesRepository.save(this.zonesRepository.create({ ...data, city }));
  }

  async updateZone(id: string, data: Partial<Zone>): Promise<Zone> {
    await this.zonesRepository.update(id, data);
    const zone = await this.zonesRepository.findOne({ where: { id } });
    if (!zone) throw new NotFoundException('Zone not found');
    return zone;
  }

  async resolveZone(latitude: number, longitude: number): Promise<Zone | null> {
    const zones = await this.zonesRepository.find({ where: { active: true } });
    let best: Zone | null = null;
    let bestPriority = -1;
    const priority: Record<ZoneType, number> = {
      restricted: 4,
      airport: 3,
      surge: 2,
      standard: 1,
    };
    for (const zone of zones) {
      const d = haversineKm(latitude, longitude, zone.centerLatitude, zone.centerLongitude);
      if (d <= zone.radiusKm && priority[zone.type] > bestPriority) {
        best = zone;
        bestPriority = priority[zone.type];
      }
    }
    return best;
  }
}
