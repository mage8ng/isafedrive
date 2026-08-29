import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Driver } from './driver.entity';
import { Vehicle } from './vehicle.entity';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { RidesModule } from '../rides/rides.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Driver, Vehicle]),
    forwardRef(() => RidesModule),
    UsersModule,
  ],
  controllers: [DriversController],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}
