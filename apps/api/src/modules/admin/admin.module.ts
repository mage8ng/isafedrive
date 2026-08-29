import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { DriversModule } from '../drivers/drivers.module';
import { RidesModule } from '../rides/rides.module';
import { WalletModule } from '../wallet/wallet.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../../auth/auth.module';
import { Driver } from '../drivers/driver.entity';
import { Vehicle } from '../drivers/vehicle.entity';
import { Ride } from '../rides/ride.entity';
import { Payment } from '../payments/payment.entity';
import { DriverWithdrawal } from '../wallet/driver-withdrawal.entity';
import { Wallet } from '../wallet/wallet.entity';
import { WalletTransaction } from '../wallet/wallet-transaction.entity';
import { SafetyIncident } from '../safety/safety-incident.entity';
import { SupportTicket } from '../support/support-ticket.entity';
import { Rating } from '../ratings/rating.entity';
import { AuditLog } from './audit-log.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Driver,
      Vehicle,
      Ride,
      Payment,
      DriverWithdrawal,
      Wallet,
      WalletTransaction,
      SafetyIncident,
      SupportTicket,
      Rating,
      AuditLog,
    ]),
    UsersModule,
    DriversModule,
    RidesModule,
    WalletModule,
    PromotionsModule,
    NotificationsModule,
    AuthModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
