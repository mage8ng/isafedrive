import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupportService } from './support.service';
import type { TicketCategory } from './support-ticket.entity';
import type { User } from '../users/user.entity';

class CreateTicketDto {
  @IsEnum(['payment', 'driver', 'passenger', 'ride', 'lost_property', 'technical', 'safety'])
  category: TicketCategory;

  @IsString() subject: string;
  @IsString() description: string;
  @IsOptional() rideId?: string;
}

@Controller()
@UseGuards(AuthGuard('jwt'))
export class SupportController {
  constructor(private supportService: SupportService) {}

  @Post('support/tickets')
  create(@CurrentUser() user: User, @Body() dto: CreateTicketDto) {
    return this.supportService.create(user, dto);
  }

  @Get('support/tickets')
  list(@CurrentUser() user: User) {
    if (user.role === 'admin' || user.role === 'super_admin') {
      return this.supportService.list();
    }
    return this.supportService.mine(user.id);
  }

  @Put('support/tickets/:id/status')
  @Roles('admin')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @CurrentUser() user: User,
  ) {
    return this.supportService.updateStatus(id, body.status, user.id);
  }
}
