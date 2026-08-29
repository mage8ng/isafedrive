import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rating } from './rating.entity';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';
import { RidesModule } from '../rides/rides.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Rating]), UsersModule, RidesModule],
  controllers: [RatingsController],
  providers: [RatingsService],
})
export class RatingsModule {}
