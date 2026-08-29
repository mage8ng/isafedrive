import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt } from 'crypto';
import { Repository } from 'typeorm';
import { haversineKm } from '@isafedrive/shared';
import { Delivery, PackageSize } from './delivery.entity';
import type { User } from '../users/user.entity';

const SIZE_MULTIPLIER: Record<PackageSize, number> = {
  small: 1,
  medium: 1.4,
  large: 1.9,
};

@Injectable()
export class DeliveryService {
  constructor(
    @InjectRepository(Delivery)
    private deliveriesRepository: Repository<Delivery>,
  ) {}

  quote(distanceKm: number, size: PackageSize): number {
    const base = 1500;
    const perKm = 120;
    const raw = (base + distanceKm * perKm) * SIZE_MULTIPLIER[size];
    return Math.round(raw / 10) * 10;
  }

  async create(
    sender: User,
    data: {
      recipientName: string;
      recipientPhone: string;
      pickupAddress: string;
      pickupLatitude: number;
      pickupLongitude: number;
      dropoffAddress: string;
      dropoffLatitude: number;
      dropoffLongitude: number;
      packageName: string;
      size?: PackageSize;
    },
  ) {
    const size = data.size ?? 'small';
    const distanceKm = haversineKm(
      data.pickupLatitude,
      data.pickupLongitude,
      data.dropoffLatitude,
      data.dropoffLongitude,
    );
    const delivery = this.deliveriesRepository.create({
      sender: { id: sender.id } as never,
      recipientName: data.recipientName,
      recipientPhone: data.recipientPhone,
      pickupAddress: data.pickupAddress,
      pickupLatitude: data.pickupLatitude,
      pickupLongitude: data.pickupLongitude,
      dropoffAddress: data.dropoffAddress,
      dropoffLatitude: data.dropoffLatitude,
      dropoffLongitude: data.dropoffLongitude,
      packageName: data.packageName,
      size,
      fee: this.quote(distanceKm, size),
      proofOtp: randomInt(0, 10000).toString().padStart(4, '0'),
      status: 'requested',
    });
    return this.deliveriesRepository.save(delivery);
  }

  async findById(id: string): Promise<Delivery> {
    const delivery = await this.deliveriesRepository.findOne({ where: { id } });
    if (!delivery) throw new NotFoundException('Delivery not found');
    return delivery;
  }

  mine(userId: string): Promise<Delivery[]> {
    return this.deliveriesRepository.find({
      where: [{ sender: { id: userId } }, { driver: { id: userId } }],
      order: { createdAt: 'DESC' },
    });
  }

  list(): Promise<Delivery[]> {
    return this.deliveriesRepository.find({ order: { createdAt: 'DESC' }, take: 200 });
  }

  async accept(id: string, driver: User): Promise<Delivery> {
    const delivery = await this.findById(id);
    if (delivery.status !== 'requested') {
      throw new BadRequestException('Delivery already taken');
    }
    delivery.driver = driver;
    delivery.status = 'driver_assigned';
    return this.deliveriesRepository.save(delivery);
  }

  async transition(id: string, to: 'picked_up' | 'in_transit'): Promise<Delivery> {
    const delivery = await this.findById(id);
    const allowed: Record<string, string[]> = {
      picked_up: ['driver_assigned'],
      in_transit: ['picked_up'],
    };
    if (!allowed[to].includes(delivery.status)) {
      throw new BadRequestException(`Cannot move from ${delivery.status} to ${to}`);
    }
    delivery.status = to;
    return this.deliveriesRepository.save(delivery);
  }

  async complete(id: string, otp: string, proofPhoto?: string): Promise<Delivery> {
    const delivery = await this.findById(id);
    if (delivery.status !== 'in_transit' && delivery.status !== 'picked_up') {
      throw new BadRequestException('Delivery not in transit');
    }
    if (delivery.proofOtp !== otp.replace(/\D/g, '')) {
      throw new BadRequestException('Invalid delivery OTP');
    }
    delivery.status = 'delivered';
    delivery.deliveredAt = new Date();
    delivery.proofPhoto = proofPhoto ?? null;
    return this.deliveriesRepository.save(delivery);
  }

  async cancel(id: string): Promise<Delivery> {
    const delivery = await this.findById(id);
    if (!['requested', 'driver_assigned'].includes(delivery.status)) {
      throw new BadRequestException('Delivery can no longer be cancelled');
    }
    delivery.status = 'cancelled';
    return this.deliveriesRepository.save(delivery);
  }
}
