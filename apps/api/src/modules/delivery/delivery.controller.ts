import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DeliveryService } from './delivery.service';
import type { PackageSize } from './delivery.entity';
import type { User } from '../users/user.entity';

class CreateDeliveryDto {
  @IsString() recipientName: string;
  @IsString() recipientPhone: string;
  @IsString() pickupAddress: string;
  @IsNumber() pickupLatitude: number;
  @IsNumber() pickupLongitude: number;
  @IsString() dropoffAddress: string;
  @IsNumber() dropoffLatitude: number;
  @IsNumber() dropoffLongitude: number;
  @IsString() packageName: string;
  @IsOptional() @IsEnum(['small', 'medium', 'large']) size?: PackageSize;
}

class QuoteDto {
  @IsNumber() @Min(0) distanceKm: number;
  @IsEnum(['small', 'medium', 'large']) size: PackageSize;
}

class CompleteDto {
  @IsString() otp: string;
  @IsOptional() @IsString() proofPhoto?: string;
}

@Controller()
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DeliveryController {
  constructor(private deliveryService: DeliveryService) {}

  @Post('deliveries/quote')
  quote(@Body() dto: QuoteDto) {
    return { fee: this.deliveryService.quote(dto.distanceKm, dto.size), currency: 'NGN' };
  }

  @Post('deliveries')
  create(@CurrentUser() user: User, @Body() dto: CreateDeliveryDto) {
    return this.deliveryService.create(user, dto);
  }

  @Get('deliveries')
  mine(@CurrentUser() user: User) {
    if (user.role === 'admin' || user.role === 'super_admin') {
      return this.deliveryService.list();
    }
    return this.deliveryService.mine(user.id);
  }

  @Get('deliveries/:id')
  get(@Param('id') id: string) {
    return this.deliveryService.findById(id);
  }

  @Post('deliveries/:id/accept')
  accept(@CurrentUser() user: User, @Param('id') id: string) {
    return this.deliveryService.accept(id, user);
  }

  @Post('deliveries/:id/picked-up')
  pickedUp(@Param('id') id: string) {
    return this.deliveryService.transition(id, 'picked_up');
  }

  @Post('deliveries/:id/in-transit')
  inTransit(@Param('id') id: string) {
    return this.deliveryService.transition(id, 'in_transit');
  }

  @Post('deliveries/:id/complete')
  complete(@Param('id') id: string, @Body() dto: CompleteDto) {
    return this.deliveryService.complete(id, dto.otp, dto.proofPhoto);
  }

  @Post('deliveries/:id/cancel')
  cancel(@Param('id') id: string) {
    return this.deliveryService.cancel(id);
  }
}
