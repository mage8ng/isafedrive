import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomInt } from 'crypto';
import {
  MATCHING,
  RIDE_PIN_LENGTH,
  RideStatus,
  haversineKm,
} from '@isafedrive/shared';
import { Ride } from './ride.entity';
import { CreateRideDto } from './dto/ride.dto';
import { DriversService } from '../drivers/drivers.service';
import { PricingService } from '../pricing/pricing.service';
import { WalletService } from '../wallet/wallet.service';
import { GeoService } from '../geo/geo.service';
import { CorporateService } from '../corporate/corporate.service';
import { FraudService } from '../fraud/fraud.service';
import { RealtimeGateway } from '../../realtime/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import type { Driver } from '../drivers/driver.entity';
import type { User } from '../users/user.entity';

@Injectable()
export class RidesService {
  constructor(
    @InjectRepository(Ride)
    private ridesRepository: Repository<Ride>,
    private driversService: DriversService,
    private pricingService: PricingService,
    private walletService: WalletService,
    private geoService: GeoService,
    private corporateService: CorporateService,
    private fraudService: FraudService,
    private realtimeGateway: RealtimeGateway,
    private notificationsService: NotificationsService,
  ) {}

  async estimate(dto: {
    categoryId: string;
    pickupLatitude: number;
    pickupLongitude: number;
    destinationLatitude: number;
    destinationLongitude: number;
  }) {
    const zone = await this.geoService.resolveZone(dto.pickupLatitude, dto.pickupLongitude);
    if (zone?.type === 'restricted') {
      throw new BadRequestException(
        `Pickup is not allowed inside restricted zone: ${zone.name}`,
      );
    }
    const distanceKm = haversineKm(
      dto.pickupLatitude,
      dto.pickupLongitude,
      dto.destinationLatitude,
      dto.destinationLongitude,
    );
    const durationMinutes = Math.max(5, Math.round((distanceKm / 25) * 60));
    const base = this.pricingService.estimate({
      categoryId: dto.categoryId as never,
      distanceKm,
      durationMinutes,
      surgeMultiplier: zone?.surgeMultiplier
        ? Math.max(1, Number(zone.surgeMultiplier))
        : undefined,
    });
    const fareMultiplier = zone ? Number(zone.fareMultiplier) : 1;
    const fare = Math.max(
      Math.round(base.fare * fareMultiplier),
      Math.round(base.fare),
    );
    return {
      distanceKm: Number(distanceKm.toFixed(2)),
      durationMinutes,
      zone: zone ? { name: zone.name, type: zone.type } : null,
      fare,
      breakdown: { ...base.breakdown, zone_multiplier: fareMultiplier },
    };
  }

  async create(passenger: User, dto: CreateRideDto): Promise<Ride> {
    const estimate = await this.estimate({
      categoryId: dto.categoryId,
      pickupLatitude: dto.pickupLatitude,
      pickupLongitude: dto.pickupLongitude,
      destinationLatitude: dto.destinationLatitude,
      destinationLongitude: dto.destinationLongitude,
    });

    let corporateAccountId: string | null = null;
    if (dto.corporateAccountId) {
      await this.corporateService.validateRideBooking(
        passenger.id,
        dto.corporateAccountId,
        estimate.fare,
      );
      corporateAccountId = dto.corporateAccountId;
    }

    const ride = this.ridesRepository.create({
      passenger: { id: passenger.id } as never,
      pickupAddress: dto.pickupAddress,
      pickupLatitude: dto.pickupLatitude,
      pickupLongitude: dto.pickupLongitude,
      destinationAddress: dto.destinationAddress,
      destinationLatitude: dto.destinationLatitude,
      destinationLongitude: dto.destinationLongitude,
      stops: dto.stops ?? null,
      note: dto.note ?? null,
      promoCode: dto.promoCode ?? null,
      scheduledAt: dto.scheduledAt ?? null,
      categoryId: dto.categoryId as never,
      paymentMethod: dto.paymentMethod ?? 'cash',
      corporateAccount: corporateAccountId ? ({ id: corporateAccountId } as never) : null,
      costCenter: dto.costCenter ?? null,
      distanceKm: estimate.distanceKm,
      durationMinutes: estimate.durationMinutes,
      fare: estimate.fare,
      pickupZone: estimate.zone?.name ?? null,
      surgeMultiplier:
        (estimate.breakdown as Record<string, number>).surge_multiplier ?? 1,
      ridePin: randomInt(0, 10 ** RIDE_PIN_LENGTH)
        .toString()
        .padStart(RIDE_PIN_LENGTH, '0'),
      status: dto.scheduledAt ? 'requested' : 'searching',
    });
    const saved = await this.ridesRepository.save(ride);

    if (!dto.scheduledAt) {
      setImmediate(() => this.dispatchToDrivers(saved.id));
    }
    setImmediate(() =>
      this.fraudService.scanUser(passenger.id).catch(() => undefined),
    );
    setImmediate(() =>
      this.notificationsService
        .send(passenger.id, 'Ride requested', 'Finding your driver…', 'ride')
        .catch(() => undefined),
    );
    return saved;
  }

  async dispatchToDrivers(rideId: string) {
    const ride = await this.ridesRepository.findOne({ where: { id: rideId } });
    if (!ride || !['requested', 'searching'].includes(ride.status)) return;

    let radius = MATCHING.radiusIncrementKm;
    while (radius <= MATCHING.maximumSearchRadiusKm + MATCHING.radiusIncrementKm) {
      const candidates = await this.findCandidates(ride, radius);
      if (candidates.length > 0) {
        const driver = candidates[0];
        this.realtimeGateway.emitToDriver(
          driver.user?.id,
          'ride_request',
          this.toRideRequestPayload(ride),
        );
        return;
      }
      if (!MATCHING.expandRadius) break;
      radius += MATCHING.radiusIncrementKm;
    }
  }

  private async findCandidates(ride: Ride, radiusKm: number): Promise<Driver[]> {
    const online = await this.driversService.findOnlineDriversByCategory(
      ride.categoryId,
    );
    return online
      .filter((d) => {
        if (d.currentLatitude == null || d.currentLongitude == null) return false;
        return (
          haversineKm(
            d.currentLatitude,
            d.currentLongitude,
            ride.pickupLatitude,
            ride.pickupLongitude,
          ) <= radiusKm
        );
      })
      .sort((a, b) => this.matchScore(ride, b) - this.matchScore(ride, a));
  }

  private matchScore(ride: Ride, d: Driver): number {
    const distance =
      d.currentLatitude != null && d.currentLongitude != null
        ? haversineKm(
            d.currentLatitude,
            d.currentLongitude,
            ride.pickupLatitude,
            ride.pickupLongitude,
          )
        : Infinity;
    return (
      Number(d.rating) * 2 +
      Number(d.acceptanceRate) / 50 -
      distance * 3
    );
  }

  toRideRequestPayload(ride: Ride) {
    return {
      rideId: ride.id,
      pickup: {
        address: ride.pickupAddress,
        latitude: ride.pickupLatitude,
        longitude: ride.pickupLongitude,
      },
      destination: {
        address: ride.destinationAddress,
        latitude: ride.destinationLatitude,
        longitude: ride.destinationLongitude,
      },
      distanceKm: ride.distanceKm,
      estimatedDurationMinutes: ride.durationMinutes,
      estimatedEarnings:
        ride.fare - Math.round((ride.fare * 20) / 100),
      vehicleCategory: ride.categoryId,
      timeoutSeconds: MATCHING.requestTimeoutSeconds,
    };
  }

  async findById(id: string): Promise<Ride> {
    const ride = await this.ridesRepository.findOne({
      where: { id },
      relations: ['passenger', 'driver', 'vehicle', 'corporateAccount'],
    });
    if (!ride) throw new NotFoundException('Ride not found');
    return ride;
  }

  async listForUser(user: User): Promise<Ride[]> {
    const where = user.role === 'driver'
      ? [{ driver: { id: user.id } }]
      : [{ passenger: { id: user.id } }];
    return this.ridesRepository.find({
      where,
      order: { requestedAt: 'DESC' },
    });
  }

  async accept(driverUser: User, rideId: string): Promise<Ride> {
    const ride = await this.findById(rideId);
    if (!['searching', 'requested'].includes(ride.status)) {
      throw new BadRequestException(`Ride is not available (${ride.status})`);
    }
    const driver = await this.driversService.findByUserId(driverUser.id);
    ride.driver = driverUser;
    ride.status = 'driver_assigned';
    await this.ridesRepository.save(ride);
    this.realtimeGateway.emitToPassenger(
      ride.passenger.id,
      'driver_assigned',
      { rideId: ride.id, driverId: driver.id },
    );
    setImmediate(() =>
      this.notificationsService
        .send(
          ride.passenger.id,
          'Driver assigned',
          `${driverUser.fullName ?? 'Your driver'} is on the way`,
          'ride',
        )
        .catch(() => undefined),
    );
    return ride;
  }

  async reject(driverUser: User, rideId: string) {
    await this.driversService.findByUserId(driverUser.id);
    setImmediate(() => this.dispatchToDrivers(rideId));
    return { rejected: true };
  }

  private async transition(
    rideId: string,
    allowedFrom: RideStatus[],
    to: RideStatus,
    patch: Partial<Ride> = {},
  ): Promise<Ride> {
    const ride = await this.findById(rideId);
    if (!allowedFrom.includes(ride.status)) {
      throw new BadRequestException(
        `Cannot move ride from ${ride.status} to ${to}`,
      );
    }
    Object.assign(ride, patch, { status: to });
    const saved = await this.ridesRepository.save(ride);
    this.realtimeGateway.emitRideStatus(saved);
    return saved;
  }

  arrived(rideId: string) {
    return this.transition(rideId, ['driver_assigned'], 'driver_arrived');
  }

  async startWithPin(rideId: string, pin: string): Promise<Ride> {
    const ride = await this.findById(rideId);
    if (ride.ridePin !== pin) throw new BadRequestException('Invalid ride PIN');
    return this.transition(
      rideId,
      ['driver_assigned', 'driver_arrived'],
      'in_progress',
      { startedAt: new Date() },
    );
  }

  async complete(rideId: string): Promise<Ride> {
    const ride = await this.transition(rideId, ['in_progress'], 'completed', {
      completedAt: new Date(),
    });

    if (ride.paymentMethod === 'wallet' && ride.driver) {
      const split = this.walletService.platformCommission(Number(ride.fare));
      await this.walletService.applyTransaction(
        ride.driver.id,
        'bonus',
        split.driverEarnings,
        `Ride earnings ${ride.id}`,
      );
    }
    if (ride.corporateAccount) {
      await this.corporateService.chargeAccount(
        ride.corporateAccount.id,
        Number(ride.fare),
        ride.id,
      );
      ride.paymentStatus = 'paid';
      await this.ridesRepository.save(ride);
    }
    setImmediate(() => {
      this.notificationsService
        .send(
          ride.passenger.id,
          'Ride completed',
          `Your trip is complete. Fare ₦${ride.fare}`,
          'ride',
        )
        .catch(() => undefined);
      if (ride.driver) {
        this.notificationsService
          .send(
            ride.driver.id,
            'Ride completed',
            `You earned from ride ${ride.id}`,
            'ride',
          )
          .catch(() => undefined);
      }
    });
    return ride;
  }

  async payRide(passenger: User, rideId: string, method: string): Promise<Ride> {
    const ride = await this.findById(rideId);
    if (ride.passenger.id !== passenger.id) {
      throw new NotFoundException('Ride not found');
    }
    if (ride.status !== 'completed') {
      throw new BadRequestException('Ride is not completed yet');
    }
    if (ride.paymentStatus === 'paid') return ride;

    ride.paymentMethod = method || ride.paymentMethod;
    if (method === 'wallet') {
      await this.walletService.applyTransaction(
        passenger.id,
        'ride_payment',
        Number(ride.fare),
        `Ride payment ${ride.id}`,
      );
      if (ride.driver) {
        const split = this.walletService.platformCommission(Number(ride.fare));
        await this.walletService.applyTransaction(
          ride.driver.id,
          'bonus',
          split.driverEarnings,
          `Ride earnings ${ride.id}`,
        );
      }
    }
    ride.paymentStatus = 'paid';
    await this.ridesRepository.save(ride);
    setImmediate(() => {
      if (ride.driver) {
        this.notificationsService
          .send(
            ride.driver.id,
            'Payment received',
            `${method} payment of ₦${ride.fare} received`,
            'payment',
          )
          .catch(() => undefined);
      }
    });
    return ride;
  }

  async trackingInfo(user: User, rideId: string) {
    const ride = await this.findById(rideId);
    const isPassenger = ride.passenger.id === user.id;
    const isDriver = ride.driver?.id === user.id;
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    if (!isPassenger && !isDriver && !isAdmin) {
      throw new NotFoundException('Ride not found');
    }

    let driver: {
      name: string;
      phone: string;
      lat: number | null;
      lng: number | null;
      rating: number;
    } | null = null;
    if (ride.driver) {
      const driverRow = await this.driversService
        .findByUserId(ride.driver.id)
        .catch(() => null);
      driver = {
        name: ride.driver.fullName ?? 'Your driver',
        phone: ride.driver.phone,
        lat: driverRow?.currentLatitude ?? null,
        lng: driverRow?.currentLongitude ?? null,
        rating: Number(ride.driver.rating),
      };
    }

    return {
      rideId: ride.id,
      status: ride.status,
      ridePin: isPassenger || isAdmin ? ride.ridePin : null,
      fare: ride.fare,
      paymentStatus: ride.paymentStatus,
      paymentMethod: ride.paymentMethod,
      distanceKm: ride.distanceKm,
      durationMinutes: ride.durationMinutes,
      pickup: {
        address: ride.pickupAddress,
        lat: ride.pickupLatitude,
        lng: ride.pickupLongitude,
      },
      destination: {
        address: ride.destinationAddress,
        lat: ride.destinationLatitude,
        lng: ride.destinationLongitude,
      },
      passenger: isDriver
        ? {
            name: ride.passenger.fullName,
            phone: ride.passenger.phone,
            rating: Number(ride.passenger.rating),
          }
        : null,
      driver,
      cancelledBy: ride.cancelledBy,
      cancelReason: ride.cancelReason,
    };
  }

  cancel(actor: User, rideId: string): Promise<Ride> {
    return this.transition(
      rideId,
      ['requested', 'searching', 'driver_assigned', 'driver_arrived'],
      'cancelled',
      { completedAt: new Date(), cancelledBy: actor.role, cancelReason: `Cancelled by ${actor.role}` },
    );
  }

  adminCancel(rideId: string, reason: string): Promise<Ride> {
    return this.transition(
      rideId,
      ['requested', 'searching', 'driver_assigned', 'driver_arrived', 'in_progress'],
      'cancelled',
      { completedAt: new Date(), cancelledBy: 'admin', cancelReason: reason },
    );
  }

  async statusCounts(): Promise<Record<string, number>> {
    const rows = await this.ridesRepository
      .createQueryBuilder('ride')
      .select('ride.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('ride.status')
      .getRawMany<{ status: string; count: string }>();
    return Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
  }

  listByStatus(status?: string): Promise<Ride[]> {
    const qb = this.ridesRepository
      .createQueryBuilder('ride')
      .leftJoinAndSelect('ride.passenger', 'passenger')
      .leftJoinAndSelect('ride.driver', 'driver')
      .orderBy('ride.requestedAt', 'DESC')
      .take(200);
    if (status) {
      if (status === 'active') {
        qb.where('ride.status IN (:...statuses)', {
          statuses: ['requested', 'searching', 'driver_assigned', 'driver_arrived', 'in_progress'],
        });
      } else {
        qb.where('ride.status = :status', { status });
      }
    }
    return qb.getMany();
  }
}
