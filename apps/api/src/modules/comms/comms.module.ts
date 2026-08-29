import { Controller, Get, Injectable, Module, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RidesModule } from '../rides/rides.module';
import { CommsService } from './comms.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '../users/user.entity';

@Controller()
@UseGuards(AuthGuard('jwt'))
export class CommsController {
  constructor(private commsService: CommsService) {}

  @Get('rides/:id/contact')
  maskedContact(@CurrentUser() user: User, @Param('id') id: string) {
    return this.commsService.maskedContactForRide(user.phone, id);
  }
}

@Module({
  imports: [RidesModule],
  controllers: [CommsController],
  providers: [CommsService],
})
export class CommsModule {}
