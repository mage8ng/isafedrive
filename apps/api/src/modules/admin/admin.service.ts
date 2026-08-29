import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KycStatus } from '@isafedrive/shared';
import { COMMISSION, PRICING, VEHICLE_CATEGORIES } from '@isafedrive/shared';
import { Driver } from '../drivers/driver.entity';
import { DriversService } from '../drivers/drivers.service';
import { Vehicle } from '../drivers/vehicle.entity';
import { Ride } from '../rides/ride.entity';
import { RidesService } from '../rides/rides.service';
import { Payment } from '../payments/payment.entity';
import { DriverWithdrawal } from '../wallet/driver-withdrawal.entity';
import { Wallet } from '../wallet/wallet.entity';
import { WalletTransaction } from '../wallet/wallet-transaction.entity';
import { WalletService } from '../wallet/wallet.service';
import { SafetyIncident } from '../safety/safety-incident.entity';
import { SupportTicket } from '../support/support-ticket.entity';
import { Rating } from '../ratings/rating.entity';
import { Promotion } from '../promotions/promotion.entity';
import { PromotionsService } from '../promotions/promotions.service';
import { Notification } from '../notifications/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { AuthService } from '../../auth/auth.service';
import { AuditLog } from './audit-log.entity';
import { User } from '../users/user.entity';

export interface AuditEntry {
  adminId: string;
  adminName?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Driver)
    private driversRepository: Repository<Driver>,
    @InjectRepository(Vehicle)
    private vehiclesRepository: Repository<Vehicle>,
    @InjectRepository(Ride)
    private ridesRepository: Repository<Ride>,
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    @InjectRepository(DriverWithdrawal)
    private withdrawalsRepository: Repository<DriverWithdrawal>,
    @InjectRepository(Wallet)
    private walletsRepository: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private walletTransactionsRepository: Repository<WalletTransaction>,
    @InjectRepository(SafetyIncident)
    private incidentsRepository: Repository<SafetyIncident>,
    @InjectRepository(SupportTicket)
    private ticketsRepository: Repository<SupportTicket>,
    @InjectRepository(Rating)
    private ratingsRepository: Repository<Rating>,
    @InjectRepository(AuditLog)
    private auditRepository: Repository<AuditLog>,
    private usersService: UsersService,
    private driversService: DriversService,
    private ridesService: RidesService,
    private walletService: WalletService,
    private promotionsService: PromotionsService,
    private notificationsService: NotificationsService,
    private authService: AuthService,
  ) {}

  setup2fa(userId: string) {
    return this.authService.setup2fa(userId);
  }

  enable2fa(userId: string, token: string) {
    return this.authService.enable2fa(userId, token);
  }

  disable2fa(userId: string, token: string) {
    return this.authService.disable2fa(userId, token);
  }

  async audit(entry: AuditEntry) {
    return this.auditRepository.save(this.auditRepository.create(entry));
  }

  auditLogs(limit = 200): Promise<AuditLog[]> {
    return this.auditRepository.find({ order: { createdAt: 'DESC' }, take: limit });
  }

  async dashboard() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalPassengers,
      totalDrivers,
      onlineDrivers,
      suspendedDrivers,
      pendingKyc,
      totalVehicles,
      activeVehicles,
      rideCounts,
      tripsToday,
      gross,
      refunds,
      avgDriverRating,
      avgPassengerRating,
      paymentMethods,
      walletFloat,
      pendingWithdrawals,
      openTickets,
      openIncidents,
      newCustomersToday,
    ] = await Promise.all([
      this.usersService.list().then((u) => u.length),
      this.usersService.list().then((u) => u.filter((x) => x.role === 'passenger').length),
      this.driversRepository.count(),
      this.driversRepository.count({ where: { onlineStatus: 'online' } }),
      this.driversRepository.count({ where: { kycStatus: 'suspended' as KycStatus } }),
      this.driversRepository.count({ where: { kycStatus: 'under_review' as KycStatus } }),
      this.vehiclesRepository.count(),
      this.vehiclesRepository.count({ where: { status: 'approved' } }),
      this.ridesService.statusCounts(),
      this.ridesRepository
        .createQueryBuilder('ride')
        .where('ride.requestedAt >= :start', { start: startOfDay })
        .getCount(),
      this.ridesRepository
        .createQueryBuilder('ride')
        .select('COALESCE(SUM(ride.fare), 0)', 'total')
        .where('ride.status = :status', { status: 'completed' })
        .getRawOne()
        .then((r) => Number(r.total)),
      this.paymentsRepository
        .createQueryBuilder('payment')
        .select('COALESCE(SUM(payment.amount), 0)', 'total')
        .where('payment.status = :status', { status: 'refunded' })
        .getRawOne()
        .then((r) => Number(r.total)),
      this.driversRepository
        .createQueryBuilder('driver')
        .select('COALESCE(AVG(driver.rating), 0)', 'avg')
        .getRawOne()
        .then((r) => Number(Number(r.avg).toFixed(2))),
      this.usersService
        .list()
        .then((users) => users.filter((u) => u.role === 'passenger'))
        .then((passengers) =>
          passengers.length
            ? Number(
                (passengers.reduce((s, u) => s + Number(u.rating), 0) / passengers.length).toFixed(2),
              )
            : 0,
        ),
      this.ridesRepository
        .createQueryBuilder('ride')
        .select('ride.paymentMethod', 'method')
        .addSelect('COUNT(*)', 'count')
        .where('ride.status = :status', { status: 'completed' })
        .groupBy('ride.paymentMethod')
        .getRawMany<{ method: string; count: string }>(),
      this.walletService.totalFloat(),
      this.withdrawalsRepository.count({ where: { status: 'pending' } }),
      this.ticketsRepository.count({ where: { status: 'open' } }),
      this.incidentsRepository.count({ where: { status: 'open' } }),
      this.usersService
        .list()
        .then((users) =>
          users.filter(
            (u) => u.role === 'passenger' && u.createdAt >= startOfDay,
          ).length,
        ),
    ]);

    const completed = rideCounts['completed'] ?? 0;
    const cancelled = rideCounts['cancelled'] ?? 0;
    const commission = Math.round((gross * COMMISSION.platformPercentage) / 100);

    return {
      users: {
        total: totalUsers,
        passengers: totalPassengers,
        newToday: newCustomersToday,
      },
      drivers: {
        total: totalDrivers,
        online: onlineDrivers,
        offline: totalDrivers - onlineDrivers,
        suspended: suspendedDrivers,
        pendingApproval: pendingKyc,
      },
      vehicles: { total: totalVehicles, active: activeVehicles },
      trips: {
        today: tripsToday,
        completed,
        cancelled,
        active:
          (rideCounts['requested'] ?? 0) +
          (rideCounts['searching'] ?? 0) +
          (rideCounts['driver_assigned'] ?? 0) +
          (rideCounts['driver_arrived'] ?? 0) +
          (rideCounts['in_progress'] ?? 0),
        scheduled: rideCounts['requested'] ?? 0,
        cancellationRate:
          completed + cancelled > 0
            ? Number(((cancelled / (completed + cancelled)) * 100).toFixed(1))
            : 0,
        averageValue: completed > 0 ? Math.round(gross / completed) : 0,
      },
      finance: {
        grossBookings: gross,
        platformCommission: commission,
        driverEarnings: gross - commission,
        refunds,
        walletFloat,
        byPaymentMethod: Object.fromEntries(
          paymentMethods.map((p) => [p.method, Number(p.count)]),
        ),
      },
      quality: {
        avgDriverRating,
        avgPassengerRating,
      },
      ops: {
        pendingWithdrawals,
        supportTickets: openTickets,
        safetyIncidents: openIncidents,
      },
    };
  }

  async globalSearch(q: string) {
    const like = `%${q}%`;
    const [users, rides, payments, promotions] = await Promise.all([
      this.usersService
        .list()
        .then((users) =>
          users
            .filter(
              (u) =>
                u.phone?.includes(q) ||
                u.email?.toLowerCase().includes(q.toLowerCase()) ||
                u.fullName?.toLowerCase().includes(q.toLowerCase()),
            )
            .slice(0, 8),
        ),
      this.ridesRepository
        .createQueryBuilder('ride')
        .leftJoinAndSelect('ride.passenger', 'passenger')
        .where(
          'ride.id::text ILIKE :like OR ride.pickupAddress ILIKE :like OR ride.destinationAddress ILIKE :like',
          { like },
        )
        .orderBy('ride.requestedAt', 'DESC')
        .take(6)
        .getMany(),
      this.paymentsRepository
        .createQueryBuilder('payment')
        .where('payment.reference ILIKE :like', { like })
        .take(6)
        .getMany(),
      this.promotionsService
        .list()
        .then((promos) => promos.filter((p) => p.code.toLowerCase().includes(q.toLowerCase())).slice(0, 6)),
    ]);
    return { users, rides, payments, promotions };
  }

  listCustomers(): Promise<User[]> {
    return this.usersService.list().then((users) => users.filter((u) => u.role !== 'admin' && u.role !== 'super_admin'));
  }

  async customerDetail(id: string) {
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('Customer not found');
    const [trips, wallet, transactions, ratingsGiven, ratingsReceived, tickets] =
      await Promise.all([
        this.ridesRepository.find({
          where: { passenger: { id } },
          order: { requestedAt: 'DESC' },
          take: 25,
        }),
        this.walletsRepository.findOne({ where: { user: { id } } }),
        this.walletTransactionsRepository
          .createQueryBuilder('tx')
          .leftJoin('tx.wallet', 'wallet')
          .where('wallet.user.id = :id', { id })
          .orderBy('tx.createdAt', 'DESC')
          .take(20)
          .getMany(),
        this.ratingsRepository.find({ where: { fromUser: { id } }, take: 10 }),
        this.ratingsRepository.find({ where: { toUser: { id } }, take: 10 }),
        this.ticketsRepository.find({ where: { user: { id } }, take: 10 }),
      ]);
    return { user, trips, wallet, transactions, ratingsGiven, ratingsReceived, tickets };
  }

  async setCustomerStatus(id: string, status: 'active' | 'suspended', admin: User, ip?: string) {
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('Customer not found');
    await this.usersService.update(id, { status });
    await this.audit({
      adminId: admin.id,
      adminName: admin.fullName,
      action: `customer_${status}`,
      targetType: 'user',
      targetId: id,
      ipAddress: ip,
    });
    return this.usersService.findById(id);
  }

  async deleteUserCascade(userId: string, admin: User, ip?: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'admin' || user.role === 'super_admin') {
      throw new Error('Administrator accounts cannot be deleted');
    }
    await this.auditRepository.manager.transaction(async (m) => {
      const id = userId;
      await m.query(
        'DELETE FROM chat_messages WHERE sender_id = $1 OR ride_id IN (SELECT id FROM rides WHERE passenger_id = $1 OR driver_id = $1)',
        [id],
      );
      await m.query(
        'DELETE FROM payments WHERE user_id = $1 OR ride_id IN (SELECT id FROM rides WHERE passenger_id = $1 OR driver_id = $1)',
        [id],
      );
      await m.query(
        'DELETE FROM wallet_transactions WHERE wallet_id IN (SELECT id FROM wallets WHERE user_id = $1)',
        [id],
      );
      await m.query('DELETE FROM wallets WHERE user_id = $1', [id]);
      await m.query('DELETE FROM ratings WHERE from_user_id = $1 OR to_user_id = $1', [id]);
      await m.query(
        'DELETE FROM support_tickets WHERE user_id = $1 OR assigned_admin_id = $1',
        [id],
      );
      await m.query('DELETE FROM notifications WHERE user_id = $1', [id]);
      await m.query('DELETE FROM fraud_alerts WHERE user_id = $1', [id]);
      await m.query('DELETE FROM safety_incidents WHERE reported_by = $1', [id]);
      await m.query('DELETE FROM corporate_employees WHERE user_id = $1', [id]);
      await m.query('DELETE FROM fleet_drivers WHERE driver_user_id = $1', [id]);
      await m.query('DELETE FROM driver_withdrawals WHERE driver_id = $1', [id]);
      await m.query('DELETE FROM rides WHERE passenger_id = $1 OR driver_id = $1', [id]);
      await m.query(
        'DELETE FROM vehicles WHERE driver_id IN (SELECT id FROM drivers WHERE user_id = $1)',
        [id],
      );
      await m.query('DELETE FROM drivers WHERE user_id = $1', [id]);
      await m.query('DELETE FROM users WHERE id = $1', [id]);
    });
    await this.audit({
      adminId: admin.id,
      adminName: admin.fullName,
      action: 'user_deleted',
      targetType: 'user',
      targetId: userId,
      details: { phone: user.phone },
      ipAddress: ip,
    });
  }

  async driverDetail(id: string) {
    const driver = await this.driversRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!driver) throw new NotFoundException('Driver not found');
    const [trips, vehicles] = await Promise.all([
      this.ridesRepository.find({
        where: { driver: { id: driver.user.id } },
        order: { requestedAt: 'DESC' },
        take: 25,
      }),
      this.vehiclesRepository.find({ where: { driver: { id } } }),
    ]);
    return { driver, trips, vehicles };
  }

  pendingKyc(): Promise<Driver[]> {
    return this.driversRepository.find({
      where: { kycStatus: 'under_review' as KycStatus },
      relations: ['user'],
    });
  }

  listDrivers(): Promise<Driver[]> {
    return this.driversRepository.find({ relations: ['user'] });
  }

  async reviewKyc(driverId: string, decision: 'approved' | 'rejected', admin: User, ip?: string) {
    const driver = await this.driversRepository.findOne({
      where: { id: driverId },
      relations: ['user'],
    });
    if (!driver) throw new NotFoundException('Driver not found');
    await this.driversRepository.update(driverId, { kycStatus: decision });
    await this.audit({
      adminId: admin.id,
      adminName: admin.fullName,
      action: `kyc_${decision}`,
      targetType: 'driver',
      targetId: driverId,
      ipAddress: ip,
    });
    return this.driversRepository.findOne({ where: { id: driverId }, relations: ['user'] });
  }

  async setDriverStatus(driverId: string, action: 'suspend' | 'reactivate', admin: User, ip?: string) {
    const driver = await this.driversRepository.findOne({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Driver not found');
    const kycStatus: KycStatus = action === 'suspend' ? 'suspended' : 'approved';
    await this.driversRepository.update(driverId, {
      kycStatus,
      onlineStatus: action === 'suspend' ? 'offline' : driver.onlineStatus,
    });
    await this.audit({
      adminId: admin.id,
      adminName: admin.fullName,
      action: `driver_${action}`,
      targetType: 'driver',
      targetId: driverId,
      ipAddress: ip,
    });
    return this.driversRepository.findOne({ where: { id: driverId }, relations: ['user'] });
  }

  listVehicles(): Promise<Vehicle[]> {
    return this.vehiclesRepository.find();
  }

  async deleteDriverAccount(driverId: string, admin: User, ip?: string) {
    const driver = await this.driversRepository.findOne({
      where: { id: driverId },
      relations: ['user'],
    });
    if (!driver?.user) throw new NotFoundException('Driver not found');
    await this.deleteUserCascade(driver.user.id, admin, ip);
    return { deleted: true };
  }

  async approveVehicle(vehicleId: string, admin: User, ip?: string) {
    await this.vehiclesRepository.update(vehicleId, { status: 'approved' });
    await this.audit({
      adminId: admin.id,
      adminName: admin.fullName,
      action: 'vehicle_approved',
      targetType: 'vehicle',
      targetId: vehicleId,
      ipAddress: ip,
    });
    const vehicle = await this.vehiclesRepository.findOne({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  listRides(status?: string): Promise<Ride[]> {
    return this.ridesService.listByStatus(status);
  }

  async adminCancelRide(rideId: string, reason: string, admin: User, ip?: string) {
    const ride = await this.ridesService.adminCancel(rideId, reason);
    await this.audit({
      adminId: admin.id,
      adminName: admin.fullName,
      action: 'ride_cancelled',
      targetType: 'ride',
      targetId: rideId,
      details: { reason },
      ipAddress: ip,
    });
    return ride;
  }

  listPayments(): Promise<Payment[]> {
    return this.paymentsRepository.find({ order: { createdAt: 'DESC' }, take: 200 });
  }

  async createManualPayment(
    data: {
      phone?: string;
      userId?: string;
      rideId?: string;
      amount: number;
      provider: string;
      status: string;
      note?: string;
    },
    admin: User,
    ip?: string,
  ): Promise<Payment> {
    let user: User | null = null;
    if (data.userId) user = await this.usersService.findById(data.userId);
    else if (data.phone) user = await this.usersService.findByPhone(data.phone);
    if (!user) throw new NotFoundException('User not found for this payment');

    const payment = await this.paymentsRepository.save(
      this.paymentsRepository.create({
        user: { id: user.id } as never,
        ride: data.rideId ? ({ id: data.rideId } as never) : null,
        amount: data.amount,
        currency: 'NGN',
        provider: data.provider as never,
        reference: `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        status: data.status as never,
      }),
    );
    await this.audit({
      adminId: admin.id,
      adminName: admin.fullName,
      action: 'payment_recorded',
      targetType: 'payment',
      targetId: payment.id,
      details: { amount: data.amount, provider: data.provider, phone: user.phone },
      ipAddress: ip,
    });
    return payment;
  }

  async createWithdrawal(
    data: {
      phone?: string;
      userId?: string;
      amount: number;
      bankName: string;
      accountNumber: string;
      accountName: string;
    },
    admin: User,
    ip?: string,
  ): Promise<DriverWithdrawal> {
    let user: User | null = null;
    if (data.userId) user = await this.usersService.findById(data.userId);
    else if (data.phone) user = await this.usersService.findByPhone(data.phone);
    if (!user) throw new NotFoundException('Driver not found');

    const withdrawal = await this.withdrawalsRepository.save(
      this.withdrawalsRepository.create({
        driver: { id: user.id } as never,
        amount: data.amount,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        reference: `ADM-PAYOUT-${Date.now()}`,
        status: 'pending',
      }),
    );
    await this.audit({
      adminId: admin.id,
      adminName: admin.fullName,
      action: 'payout_created',
      targetType: 'withdrawal',
      targetId: withdrawal.id,
      details: { amount: data.amount, driver: user.phone },
      ipAddress: ip,
    });
    return withdrawal;
  }

  listWallets() {
    return this.walletService.listWallets();
  }

  async adjustWallet(userId: string, amount: number, reason: string, admin: User, ip?: string) {
    const tx = await this.walletService.adminAdjustment(userId, amount, `Admin: ${reason}`);
    await this.audit({
      adminId: admin.id,
      adminName: admin.fullName,
      action: amount > 0 ? 'wallet_credit' : 'wallet_debit',
      targetType: 'wallet',
      targetId: userId,
      details: { amount, reason },
      ipAddress: ip,
    });
    return tx;
  }

  listTransactions(): Promise<WalletTransaction[]> {
    return this.walletTransactionsRepository
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.wallet', 'wallet')
      .leftJoinAndSelect('wallet.user', 'user')
      .orderBy('tx.createdAt', 'DESC')
      .take(200)
      .getMany();
  }

  listWithdrawals(): Promise<DriverWithdrawal[]> {
    return this.withdrawalsRepository.find({ order: { createdAt: 'DESC' } });
  }

  async processWithdrawal(id: string, status: 'paid' | 'rejected', admin: User, ip?: string) {
    await this.withdrawalsRepository.update(id, { status, processedAt: new Date() });
    const withdrawal = await this.withdrawalsRepository.findOne({ where: { id } });
    if (!withdrawal) throw new NotFoundException('Withdrawal not found');
    await this.audit({
      adminId: admin.id,
      adminName: admin.fullName,
      action: `withdrawal_${status}`,
      targetType: 'withdrawal',
      targetId: id,
      details: { amount: withdrawal.amount },
      ipAddress: ip,
    });
    return withdrawal;
  }

  listPromotions(): Promise<Promotion[]> {
    return this.promotionsService.list();
  }

  async createPromotion(data: Partial<Promotion>, admin: User, ip?: string) {
    const promo = await this.promotionsService.create(data);
    await this.audit({
      adminId: admin.id,
      adminName: admin.fullName,
      action: 'promotion_created',
      targetType: 'promotion',
      targetId: promo.id,
      details: { code: promo.code, type: promo.type, value: promo.value },
      ipAddress: ip,
    });
    return promo;
  }

  async disablePromotion(id: string, admin: User, ip?: string) {
    const promo = await this.promotionsService.disable(id);
    await this.audit({
      adminId: admin.id,
      adminName: admin.fullName,
      action: 'promotion_disabled',
      targetType: 'promotion',
      targetId: id,
      ipAddress: ip,
    });
    return promo;
  }

  listRatings(): Promise<Rating[]> {
    return this.ratingsRepository
      .createQueryBuilder('rating')
      .leftJoinAndSelect('rating.fromUser', 'fromUser')
      .leftJoinAndSelect('rating.toUser', 'toUser')
      .leftJoinAndSelect('rating.ride', 'ride')
      .orderBy('rating.createdAt', 'DESC')
      .take(200)
      .getMany();
  }

  listIncidents(): Promise<SafetyIncident[]> {
    return this.incidentsRepository.find({ order: { createdAt: 'DESC' } });
  }

  async resolveIncident(id: string, admin: User, ip?: string) {
    await this.incidentsRepository.update(id, { status: 'resolved', resolvedAt: new Date() });
    await this.audit({
      adminId: admin.id,
      adminName: admin.fullName,
      action: 'incident_resolved',
      targetType: 'safety_incident',
      targetId: id,
      ipAddress: ip,
    });
    const incident = await this.incidentsRepository.findOne({ where: { id } });
    if (!incident) throw new NotFoundException('Incident not found');
    return incident;
  }

  listTickets(): Promise<SupportTicket[]> {
    return this.ticketsRepository.find({ order: { createdAt: 'DESC' } });
  }

  async updateTicketStatus(id: string, status: string, admin: User, ip?: string) {
    await this.ticketsRepository.update(id, {
      status: status as never,
      resolvedAt: status === 'resolved' ? new Date() : null,
      assignedAdmin: { id: admin.id } as never,
    });
    await this.audit({
      adminId: admin.id,
      adminName: admin.fullName,
      action: `ticket_${status}`,
      targetType: 'support_ticket',
      targetId: id,
      ipAddress: ip,
    });
    const ticket = await this.ticketsRepository.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  onlineDrivers(): Promise<Driver[]> {
    return this.driversRepository.find({
      where: { onlineStatus: 'online' },
      relations: ['user'],
    });
  }

  async liveOverview() {
    const [drivers, vehicles, activeRides] = await Promise.all([
      this.driversRepository.find({ relations: ['user'] }),
      this.vehiclesRepository.find(),
      this.ridesService.listByStatus('active'),
    ]);

    const vehicleByDriverId = new Map<string, Vehicle>();
    for (const v of vehicles) {
      const driverId = (v.driver as { id?: string } | null)?.id;
      if (driverId && !vehicleByDriverId.has(driverId)) vehicleByDriverId.set(driverId, v);
    }

    const driverByUserId = new Map<string, Driver>();
    for (const d of drivers) {
      if (d.user?.id) driverByUserId.set(d.user.id, d);
    }

    return {
      drivers: drivers.map((d) => {
        const v = vehicleByDriverId.get(d.id);
        return {
          driverId: d.id,
          userId: d.user?.id,
          name: d.user?.fullName ?? 'Driver',
          phone: d.user?.phone ?? '',
          lat: d.currentLatitude,
          lng: d.currentLongitude,
          online: d.onlineStatus === 'online',
          onTrip: activeRides.some((r) => r.driver?.id === d.user?.id),
          rating: d.rating,
          kycStatus: d.kycStatus,
          vehicle: v
            ? {
                make: v.make,
                model: v.model,
                plate: v.plateNumber,
                category: v.categoryId,
                color: v.color,
              }
            : null,
        };
      }),
      trips: activeRides
        .filter((r) => r.driver)
        .map((r) => {
          const driver = r.driver ? driverByUserId.get(r.driver.id) : null;
          const v = driver ? vehicleByDriverId.get(driver.id) : null;
          return {
            rideId: r.id,
            status: r.status,
            driverUserId: r.driver?.id,
            driverName: r.driver?.fullName ?? 'Driver',
            driverPhone: r.driver?.phone ?? '',
            vehicle: v ? `${v.color ?? ''} ${v.make} ${v.model}` : 'Taxi',
            plate: v?.plateNumber ?? '',
            from: driver?.currentLatitude != null
              ? [driver.currentLatitude, driver.currentLongitude]
              : [r.pickupLatitude, r.pickupLongitude],
            to: [r.destinationLatitude, r.destinationLongitude],
            toAddress: r.destinationAddress,
            pickupAddress: r.pickupAddress,
          };
        }),
    };
  }

  pricingConfig() {
    return {
      categories: VEHICLE_CATEGORIES,
      fees: {
        bookingFee: PRICING.bookingFee,
        waitingFeePerMinute: PRICING.waitingFeePerMinute,
        cancellationFee: PRICING.cancellationFee,
        airportFee: PRICING.airportFee,
      },
      commission: COMMISSION,
      surge: PRICING.surge,
    };
  }

  async broadcast(role: string | null, title: string, message: string, admin: User, ip?: string) {
    const result = await this.notificationsService.broadcast(role, title, message);
    await this.audit({
      adminId: admin.id,
      adminName: admin.fullName,
      action: 'notification_broadcast',
      targetType: 'notification',
      details: { role, title, sent: result.sent },
      ipAddress: ip,
    });
    return result;
  }

  listAdmins(): Promise<User[]> {
    return this.usersService.list().then((users) => users.filter((u) => u.role === 'admin' || u.role === 'super_admin'));
  }

  async createAdmin(fullName: string, phone: string, admin: User, ip?: string) {
    const existing = await this.usersService.findByPhone(phone);
    if (existing) {
      await this.usersService.update(existing.id, { role: 'admin', fullName });
    } else {
      await this.usersService.create({ fullName, phone, role: 'admin' });
    }
    await this.audit({
      adminId: admin.id,
      adminName: admin.fullName,
      action: 'admin_created',
      targetType: 'user',
      details: { phone, fullName },
      ipAddress: ip,
    });
    return this.usersService.findByPhone(phone);
  }

  async tripsCsv(): Promise<string> {
    const rides = await this.ridesRepository
      .createQueryBuilder('ride')
      .leftJoinAndSelect('ride.passenger', 'passenger')
      .leftJoinAndSelect('ride.driver', 'driver')
      .orderBy('ride.requestedAt', 'DESC')
      .take(1000)
      .getMany();
    const header = 'ride_id,status,passenger,driver,fare_ngn,payment_method,distance_km,pickup,destination,requested_at,completed_at';
    const rows = rides.map((r) =>
      [
        r.id,
        r.status,
        r.passenger?.phone ?? '',
        r.driver?.phone ?? '',
        r.fare,
        r.paymentMethod,
        r.distanceKm ?? '',
        `"${r.pickupAddress}"`,
        `"${r.destinationAddress}"`,
        r.requestedAt?.toISOString() ?? '',
        r.completedAt?.toISOString() ?? '',
      ].join(','),
    );
    return [header, ...rows].join('\n');
  }

  async paymentsCsv(): Promise<string> {
    const payments = await this.paymentsRepository.find({ take: 1000, order: { createdAt: 'DESC' } });
    const header = 'payment_id,ride_id,amount_ngn,currency,provider,reference,status,created_at';
    const rows = payments.map((p) =>
      [p.id, p.ride ? (p.ride as { id: string }).id : '', p.amount, p.currency, p.provider, p.reference, p.status, p.createdAt.toISOString()].join(','),
    );
    return [header, ...rows].join('\n');
  }
}
