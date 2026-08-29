import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RidesService } from './rides.service';
import { DriversService } from '../drivers/drivers.service';
import { CreateRideDto, EstimateRideDto, RateRideDto } from './dto/ride.dto';
import type { User } from '../users/user.entity';

@Controller()
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class RidesController {
  constructor(
    private ridesService: RidesService,
    @Inject(forwardRef(() => DriversService))
    private driversService: DriversService,
  ) {}

  @Get('rides/nearby-drivers')
  nearbyDrivers() {
    return this.driversService.onlineDriversDetailed();
  }

  @Post('rides/estimate')
  estimate(@Body() dto: EstimateRideDto) {
    return this.ridesService.estimate(dto);
  }

  @Post('rides')
  create(@CurrentUser() user: User, @Body() dto: CreateRideDto) {
    return this.ridesService.create(user, dto);
  }

  @Get('rides/:id')
  get(@Param('id') id: string) {
    return this.ridesService.findById(id);
  }

  @Get('rides/:id/tracking')
  async tracking(@CurrentUser() user: User, @Param('id') id: string) {
    return this.ridesService.trackingInfo(user, id);
  }

  @Get('passengers/rides')
  myPassengerRides(@CurrentUser() user: User) {
    return this.ridesService.listForUser(user);
  }

  @Get('drivers/rides')
  myDriverRides(@CurrentUser() user: User) {
    return this.ridesService.listForUser(user);
  }

  @Post('rides/:id/accept')
  accept(@CurrentUser() user: User, @Param('id') id: string) {
    return this.ridesService.accept(user, id);
  }

  @Post('rides/:id/reject')
  reject(@CurrentUser() user: User, @Param('id') id: string) {
    return this.ridesService.reject(user, id);
  }

  @Post('rides/:id/arrived')
  arrived(@Param('id') id: string) {
    return this.ridesService.arrived(id);
  }

  @Post('rides/:id/start')
  start(@Param('id') id: string, @Body() body: { pin: string }) {
    return this.ridesService.startWithPin(id, body.pin ?? '');
  }

  @Post('rides/:id/complete')
  complete(@Param('id') id: string) {
    return this.ridesService.complete(id);
  }

  @Post('rides/:id/pay')
  pay(@CurrentUser() user: User, @Param('id') id: string, @Body() body: { method?: string }) {
    return this.ridesService.payRide(user, id, body?.method ?? 'cash');
  }

  @Post('rides/:id/cancel')
  cancel(@CurrentUser() user: User, @Param('id') id: string) {
    return this.ridesService.cancel(user, id);
  }
}
