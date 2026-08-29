import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FleetService } from './fleet.service';
import type { User } from '../users/user.entity';

class CreateFleetDto {
  @IsString() name: string;
  @IsOptional() @IsNumber() commissionPercent?: number;
}

class AddDriverDto {
  @IsString() driverPhone: string;
}

@Controller()
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class FleetController {
  constructor(private fleetService: FleetService) {}

  @Get('fleets/my')
  myFleets(@CurrentUser() user: User) {
    return this.fleetService.myFleets(user.id);
  }

  @Post('fleets')
  createMine(@CurrentUser() user: User, @Body() dto: CreateFleetDto) {
    return this.fleetService.createByOwner(dto.name, { id: user.id });
  }

  @Post('admin/fleets')
  @Roles('admin')
  create(@Body() dto: CreateFleetDto & { ownerPhone?: string }) {
    return this.fleetService.create(dto.name, dto.ownerPhone ?? '', dto.commissionPercent ?? 10);
  }

  @Get('admin/fleets')
  @Roles('admin')
  list() {
    return this.fleetService.list();
  }

  @Get('admin/fleets/:id')
  @Roles('admin')
  detail(@Param('id') id: string) {
    return this.fleetService.detail(id);
  }

  @Post('admin/fleets/:id/drivers')
  @Roles('admin')
  addDriver(@Param('id') id: string, @Body() dto: AddDriverDto) {
    return this.fleetService.addDriver(id, dto.driverPhone);
  }

  @Post('admin/fleets/:id/drivers/remove')
  @Roles('admin')
  removeDriver(@Param('id') id: string, @Body() dto: AddDriverDto) {
    return this.fleetService.removeDriver(id, dto.driverPhone);
  }
}
