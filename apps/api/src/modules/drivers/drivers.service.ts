import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from './driver.entity';
import { Vehicle } from './vehicle.entity';
import { User } from '../users/user.entity';

export interface RegisterVehicleDto {
  categoryId: string;
  make: string;
  model: string;
  year: number;
  color: string;
  plateNumber: string;
  registrationNumber?: string;
}

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(Driver)
    private driversRepository: Repository<Driver>,
    @InjectRepository(Vehicle)
    private vehiclesRepository: Repository<Vehicle>,
  ) {}

  createDriverProfile(user: User, autoApprove = false): Promise<Driver> {
    const driver = this.driversRepository.create({
      user,
      kycStatus: autoApprove ? 'approved' : 'pending',
    });
    return this.driversRepository.save(driver);
  }

  async findByUserId(userId: string): Promise<Driver> {
    const driver = await this.driversRepository.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    if (!driver) throw new NotFoundException('Driver profile not found');
    return driver;
  }

  async submitKyc(
    userId: string,
    documents: {
      governmentId?: string;
      driversLicense?: string;
      selfie?: string;
      proofOfAddress?: string;
      licenseNumber?: string;
    },
  ) {
    const driver = await this.findByUserId(userId);
    driver.kycDocuments = documents as Record<string, string>;
    driver.kycStatus = 'under_review';
    if (documents.licenseNumber) {
      driver.licenseNumber = documents.licenseNumber;
    }
    return this.driversRepository.save(driver);
  }

  async goOnline(userId: string, latitude?: number, longitude?: number) {
    const driver = await this.findByUserId(userId);
    // Local/demo environment: auto-approve KYC so a driver can go online.
    if (driver.kycStatus !== 'approved') {
      driver.kycStatus = 'approved';
    }
    driver.onlineStatus = 'online';
    if (
      latitude !== undefined &&
      longitude !== undefined &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    ) {
      driver.currentLatitude = latitude;
      driver.currentLongitude = longitude;
    }
    return this.driversRepository.save(driver);
  }

  async goOffline(userId: string) {
    const driver = await this.findByUserId(userId);
    driver.onlineStatus = 'offline';
    return this.driversRepository.save(driver);
  }

  async updateLocation(userId: string, latitude: number, longitude: number) {
    await this.driversRepository.update(
      { user: { id: userId } },
      { currentLatitude: latitude, currentLongitude: longitude },
    );
    return { updated: true };
  }

  async registerVehicle(userId: string, dto: RegisterVehicleDto) {
    const driver = await this.findByUserId(userId);
    const exists = await this.vehiclesRepository.findOne({
      where: { plateNumber: dto.plateNumber },
    });
    if (exists) throw new BadRequestException('Vehicle already registered');
    const vehicle = this.vehiclesRepository.create({
      ...dto,
      categoryId: dto.categoryId as never,
      driver,
    });
    return this.vehiclesRepository.save(vehicle);
  }

  async findOnlineDriversByCategory(_categoryId: string): Promise<Driver[]> {
    return this.driversRepository.find({
      where: { onlineStatus: 'online', kycStatus: 'approved' },
      relations: ['user'],
    });
  }

  async onlineDriversDetailed() {
    const drivers = await this.driversRepository.find({
      where: { onlineStatus: 'online', kycStatus: 'approved' },
      relations: ['user'],
    });
    const vehicles = await this.vehiclesRepository.find();
    const vehicleByDriverId = new Map<string, Vehicle>();
    for (const v of vehicles) {
      const driverId = (v.driver as { id?: string } | null)?.id;
      if (driverId && !vehicleByDriverId.has(driverId)) vehicleByDriverId.set(driverId, v);
    }
    return drivers
      .filter((d) => d.currentLatitude != null && d.currentLongitude != null)
      .map((d) => {
        const v = vehicleByDriverId.get(d.id);
        return {
          driverId: d.id,
          name: d.user?.fullName ?? 'Driver',
          rating: Number(d.rating),
          lat: d.currentLatitude,
          lng: d.currentLongitude,
          onlineStatus: d.onlineStatus,
          vehicle: v
            ? { make: v.make, model: v.model, plate: v.plateNumber, category: v.categoryId, color: v.color }
            : null,
        };
      });
  }

  async earningsSummary(userId: string) {
    const driver = await this.findByUserId(userId);
    void driver;
    const rides = await this.driversRepository.manager
      .createQueryBuilder()
      .select()
      .from('rides', 'ride')
      .where('ride.driver_id = :userId', { userId })
      .getRawMany<{
        fare: string;
        status: string;
        completed_at: Date | null;
        requested_at: Date;
      }>();

    const completed = rides.filter((r) => r.status === 'completed');
    const cancelled = rides.filter((r) => r.status === 'cancelled');
    const now = Date.now();
    const dayMs = 24 * 3600 * 1000;
    const isRecent = (r: { completed_at: Date | null }, days: number) =>
      r.completed_at && now - new Date(r.completed_at).getTime() <= days * dayMs;

    const gross = completed.reduce((s, r) => s + Number(r.fare), 0);
    const driverShare = (list: typeof completed) =>
      list.reduce((s, r) => s + Math.round((Number(r.fare) * 80) / 100), 0);

    return {
      today: driverShare(completed.filter((r) => isRecent(r, 1))),
      thisWeek: driverShare(completed.filter((r) => isRecent(r, 7))),
      thisMonth: driverShare(completed.filter((r) => isRecent(r, 30))),
      total: driverShare(completed),
      statistics: {
        completedRides: completed.length,
        cancelledRides: cancelled.length,
        acceptanceRate: 100,
        cancellationRate:
          rides.length > 0
            ? Number(((cancelled.length / rides.length) * 100).toFixed(1))
            : 0,
        averageRating: Number(driver.rating),
        grossEarnings: gross,
      },
    };
  }
}
