import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { Ride } from '../rides/ride.entity';
import { CorporateAccount, CorporateEmployee } from './corporate-account.entity';
import { CorporateController } from './corporate.controller';
import { CorporateService } from './corporate.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CorporateAccount, CorporateEmployee, Ride]),
    UsersModule,
  ],
  controllers: [CorporateController],
  providers: [CorporateService],
  exports: [CorporateService],
})
export class CorporateModule {}
