import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RateRideDto } from '../rides/dto/ride.dto';
import { RatingsService } from './ratings.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '../users/user.entity';

@Controller()
@UseGuards(AuthGuard('jwt'))
export class RatingsController {
  constructor(private ratingsService: RatingsService) {}

  @Post('rides/:id/rate')
  rate(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: RateRideDto) {
    return this.ratingsService.rateRide(user, id, dto);
  }

  @Get('ratings')
  mine(@CurrentUser() user: User) {
    return this.ratingsService.forUser(user.id);
  }
}
