import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Fleet, FleetDriver } from './fleet.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class FleetService {
  constructor(
    @InjectRepository(Fleet)
    private fleetsRepository: Repository<Fleet>,
    @InjectRepository(FleetDriver)
    private fleetDriversRepository: Repository<FleetDriver>,
    private usersService: UsersService,
  ) {}

  async create(name: string, ownerPhone: string, commissionPercent = 10): Promise<Fleet> {
    let owner = await this.usersService.findByPhone(ownerPhone);
    if (!owner) {
      owner = await this.usersService.create({ phone: ownerPhone, role: 'passenger' });
    }
    return this.fleetsRepository.save(
      this.fleetsRepository.create({ name, owner, commissionPercent }),
    );
  }

  list(): Promise<Fleet[]> {
    return this.fleetsRepository.find({ relations: ['owner'] });
  }

  async addDriver(fleetId: string, driverPhone: string): Promise<FleetDriver> {
    const fleet = await this.fleetsRepository.findOne({ where: { id: fleetId } });
    if (!fleet) throw new NotFoundException('Fleet not found');
    let user = await this.usersService.findByPhone(driverPhone);
    if (!user) throw new NotFoundException('Driver account not found - driver must register first');
    const existing = await this.fleetDriversRepository.findOne({
      where: { fleet: { id: fleetId }, driverUser: { id: user.id } },
    });
    if (existing) {
      existing.active = true;
      return this.fleetDriversRepository.save(existing);
    }
    return this.fleetDriversRepository.save(
      this.fleetDriversRepository.create({ fleet, driverUser: user }),
    );
  }

  async removeDriver(fleetId: string, driverPhone: string) {
    const user = await this.usersService.findByPhone(driverPhone);
    if (!user) throw new NotFoundException('Driver not found');
    const membership = await this.fleetDriversRepository.findOne({
      where: { fleet: { id: fleetId }, driverUser: { id: user.id } },
    });
    if (!membership) throw new NotFoundException('Driver not in this fleet');
    membership.active = false;
    return this.fleetDriversRepository.save(membership);
  }

  async detail(fleetId: string) {
    const fleet = await this.fleetsRepository.findOne({
      where: { id: fleetId },
      relations: ['owner'],
    });
    if (!fleet) throw new NotFoundException('Fleet not found');
    const drivers = await this.fleetDriversRepository.find({
      where: { fleet: { id: fleetId } },
      relations: ['driverUser'],
    });
    const driverUserIds = drivers.filter((d) => d.active).map((d) => d.driverUser.id);
    const vehicles = await this.fleetsRepository.manager
      .getRepository('Vehicle')
      .find({ where: driverUserIds.length > 0 ? { driver: { user: { id: In(driverUserIds) } } } : {} });
    const rides = await this.fleetsRepository.manager.getRepository('Ride').find({
      where: { driver: { id: In(driverUserIds.length > 0 ? driverUserIds : ['00000000-0000-0000-0000-000000000000']) } },
    });
    const completedRides = (rides as { status: string; fare: string | number }[]).filter(
      (r) => r.status === 'completed',
    );
    const grossEarnings = completedRides.reduce((s, r) => s + Number(r.fare), 0);
    const fleetCommission = Math.round(
      (grossEarnings * Number(fleet.commissionPercent)) / 100,
    );
    return {
      fleet,
      drivers,
      vehicles,
      performance: {
        completedTrips: completedRides.length,
        grossEarnings,
        fleetCommission,
        driverPayouts: grossEarnings - fleetCommission,
      },
    };
  }

  async activeFleetForDriver(driverUserId: string): Promise<Fleet | null> {
    const membership = await this.fleetDriversRepository.findOne({
      where: { driverUser: { id: driverUserId }, active: true },
      relations: ['fleet'],
    });
    if (!membership || !membership.fleet.active) return null;
    return membership.fleet;
  }

  async createByOwner(name: string, owner: { id: string }): Promise<Fleet> {
    if (!name?.trim()) throw new BadRequestException('Fleet name required');
    const user = await this.usersService.findById(owner.id);
    if (!user) throw new NotFoundException('User not found');
    return this.fleetsRepository.save(
      this.fleetsRepository.create({ name, owner: user }),
    );
  }

  myFleets(ownerId: string): Promise<Fleet[]> {
    return this.fleetsRepository.find({ where: { owner: { id: ownerId } } });
  }
}
