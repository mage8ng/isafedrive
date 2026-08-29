import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { SafetyIncident } from './safety-incident.entity';
import { SafetyController } from './safety.controller';
import { SafetyService } from './safety.service';

@Module({
  imports: [TypeOrmModule.forFeature([SafetyIncident]), UsersModule],
  controllers: [SafetyController],
  providers: [SafetyService],
})
export class SafetyModule {}
