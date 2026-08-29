import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { RidesModule } from './modules/rides/rides.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { SupportModule } from './modules/support/support.module';
import { SafetyModule } from './modules/safety/safety.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { PassengersModule } from './modules/passengers/passengers.module';
import { GeoModule } from './modules/geo/geo.module';
import { CorporateModule } from './modules/corporate/corporate.module';
import { FleetModule } from './modules/fleet/fleet.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { ChatModule } from './modules/chat/chat.module';
import { CommsModule } from './modules/comms/comms.module';
import { FraudModule } from './modules/fraud/fraud.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres' as const,
        url:
          process.env.DATABASE_URL ??
          'postgresql://postgres:postgres@localhost:5432/isafedrive',
        autoLoadEntities: true,
        synchronize: process.env.NODE_ENV !== 'production',
        ssl: /sslmode=require/.test(process.env.DATABASE_URL ?? '')
          ? { rejectUnauthorized: false }
          : undefined,
      }),
    }),
    AuthModule,
    UsersModule,
    DriversModule,
    RidesModule,
    PricingModule,
    PaymentsModule,
    WalletModule,
    RatingsModule,
    PromotionsModule,
    SupportModule,
    SafetyModule,
    NotificationsModule,
    AdminModule,
    PassengersModule,
    GeoModule,
    CorporateModule,
    FleetModule,
    DeliveryModule,
    ChatModule,
    CommsModule,
    FraudModule,
    RealtimeModule,
  ],
})
export class AppModule {}
