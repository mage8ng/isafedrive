import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ride } from './ride.entity';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';
import { DriversModule } from '../drivers/drivers.module';
import { PricingModule } from '../pricing/pricing.module';
import { WalletModule } from '../wallet/wallet.module';
import { GeoModule } from '../geo/geo.module';
import { CorporateModule } from '../corporate/corporate.module';
import { FraudModule } from '../fraud/fraud.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ride]),
    forwardRef(() => DriversModule),
    PricingModule,
    WalletModule,
    GeoModule,
    CorporateModule,
    FraudModule,
    NotificationsModule,
    RealtimeModule,
  ],
  controllers: [RidesController],
  providers: [RidesService],
  exports: [RidesService],
})
export class RidesModule {}
