import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CorporateAccount, CorporateEmployee } from './corporate-account.entity';
import { UsersService } from '../users/users.service';
import { Ride } from '../rides/ride.entity';

@Injectable()
export class CorporateService {
  constructor(
    @InjectRepository(CorporateAccount)
    private accountsRepository: Repository<CorporateAccount>,
    @InjectRepository(CorporateEmployee)
    private employeesRepository: Repository<CorporateEmployee>,
    @InjectRepository(Ride)
    private ridesRepository: Repository<Ride>,
    private usersService: UsersService,
  ) {}

  async createAccount(name: string, adminPhone: string): Promise<CorporateAccount> {
    let adminUser = await this.usersService.findByPhone(adminPhone);
    if (!adminUser) {
      adminUser = await this.usersService.create({ phone: adminPhone, role: 'passenger' });
    }
    return this.accountsRepository.save(
      this.accountsRepository.create({ name, adminUser }),
    );
  }

  listAccounts(): Promise<CorporateAccount[]> {
    return this.accountsRepository.find({ relations: ['adminUser'] });
  }

  async accountDetail(id: string) {
    const account = await this.accountsRepository.findOne({
      where: { id },
      relations: ['adminUser'],
    });
    if (!account) throw new NotFoundException('Corporate account not found');
    const employees = await this.employeesRepository.find({
      where: { account: { id } },
      relations: ['user'],
    });
    return { account, employees };
  }

  async topUp(id: string, amount: number): Promise<CorporateAccount> {
    const account = await this.accountsRepository.findOne({ where: { id } });
    if (!account) throw new NotFoundException('Corporate account not found');
    account.balance = Number(account.balance) + amount;
    return this.accountsRepository.save(account);
  }

  async addEmployee(
    accountId: string,
    phone: string,
    perRideLimit?: number,
    monthlyLimit?: number,
    department?: string,
  ): Promise<CorporateEmployee> {
    const account = await this.accountsRepository.findOne({ where: { id: accountId } });
    if (!account) throw new NotFoundException('Corporate account not found');
    let user = await this.usersService.findByPhone(phone);
    if (!user) {
      user = await this.usersService.create({ phone, role: 'passenger' });
    }
    const existing = await this.employeesRepository.findOne({
      where: { user: { id: user.id }, account: { id: accountId } },
    });
    if (existing) throw new BadRequestException('User is already an employee of this account');
    return this.employeesRepository.save(
      this.employeesRepository.create({
        account,
        user,
        perRideLimit: perRideLimit ?? null,
        monthlyLimit: monthlyLimit ?? null,
        department: department ?? null,
      }),
    );
  }

  accountsForUser(userId: string): Promise<CorporateEmployee[]> {
    return this.employeesRepository.find({
      where: { user: { id: userId }, active: true },
      relations: ['account'],
    });
  }

  async validateRideBooking(userId: string, accountId: string, fare: number) {
    const employee = await this.employeesRepository.findOne({
      where: { user: { id: userId }, account: { id: accountId } },
      relations: ['account'],
    });
    if (!employee || !employee.active) {
      throw new BadRequestException('You are not an active employee of this corporate account');
    }
    if (!employee.account.active) throw new BadRequestException('Corporate account is inactive');
    if (employee.perRideLimit && fare > Number(employee.perRideLimit)) {
      throw new BadRequestException(
        `Fare exceeds per-ride limit of NGN ${employee.perRideLimit}`,
      );
    }
    if (employee.monthlyLimit) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const spent = await this.employeesRepository
        .createQueryBuilder('employee')
        .leftJoin('employee.account', 'account')
        .innerJoin('rides', 'ride', 'ride.corporate_account_id = account.id')
        .where('employee.user.id = :userId', { userId })
        .andWhere('ride.requestedAt >= :monthStart', { monthStart })
        .select('COALESCE(SUM(ride.fare), 0)', 'total')
        .getRawOne()
        .then((r) => Number(r?.total ?? 0));
      if (spent + fare > Number(employee.monthlyLimit)) {
        throw new BadRequestException(
          `Monthly corporate limit of NGN ${employee.monthlyLimit} exceeded`,
        );
      }
    }
    if (Number(employee.account.balance) < fare) {
      throw new BadRequestException('Corporate account has insufficient balance');
    }
    return employee;
  }

  async chargeAccount(accountId: string, fare: number, rideId: string) {
    const account = await this.accountsRepository.findOne({ where: { id: accountId } });
    if (!account) return;
    account.balance = Number(account.balance) - fare;
    await this.accountsRepository.save(account);
  }

  async monthlyInvoice(accountId: string, year?: number, month?: number) {
    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month ?? now.getMonth() + 1;
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    const account = await this.accountsRepository.findOne({ where: { id: accountId } });
    if (!account) throw new NotFoundException('Corporate account not found');

    const rides = await this.ridesRepository
      .createQueryBuilder('ride')
      .leftJoinAndSelect('ride.passenger', 'passenger')
      .where('ride.corporateAccount.id = :accountId', { accountId })
      .andWhere('ride.requestedAt >= :start AND ride.requestedAt < :end', { start, end })
      .orderBy('ride.requestedAt', 'ASC')
      .getMany();

    const byEmployee = new Map<string, { phone: string; trips: number; total: number }>();
    let grandTotal = 0;
    for (const ride of rides) {
      if (ride.status !== 'completed') continue;
      const phone = ride.passenger?.phone ?? 'unknown';
      const entry = byEmployee.get(phone) ?? { phone, trips: 0, total: 0 };
      entry.trips += 1;
      entry.total += Number(ride.fare);
      grandTotal += Number(ride.fare);
      byEmployee.set(phone, entry);
    }
    return {
      account: account.name,
      period: `${y}-${String(m).padStart(2, '0')}`,
      trips: rides.filter((r) => r.status === 'completed').length,
      total: grandTotal,
      byEmployee: [...byEmployee.values()],
      rides: rides.map((r) => ({
        id: r.id,
        passenger: r.passenger?.phone,
        fare: r.fare,
        costCenter: r.costCenter,
        status: r.status,
        requestedAt: r.requestedAt,
      })),
    };
  }
}
