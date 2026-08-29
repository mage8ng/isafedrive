import { Body, Controller, Get, Inject, Post, Put, UseGuards, forwardRef } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DriversService, RegisterVehicleDto } from './drivers.service';
import { RidesService } from '../rides/rides.service';
import { UsersService } from '../users/users.service';
import { UpdateProfileDto, sanitizeUser } from '../passengers/passengers.module';
import type { User } from '../users/user.entity';

@Controller('drivers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('driver')
export class DriversController {
  constructor(
    private driversService: DriversService,
    private usersService: UsersService,
    @Inject(forwardRef(() => RidesService))
    private ridesService: RidesService,
  ) {}

  @Get('profile')
  async profile(@CurrentUser() user: User) {
    const driver = await this.driversService.findByUserId(user.id);
    const fresh = await this.usersService.findById(user.id);
    const { passwordHash, twofaSecret, lastDeviceId, ...safeUser } = fresh ?? user;
    void passwordHash;
    void twofaSecret;
    void lastDeviceId;
    return { user: safeUser, driver };
  }

  @Put('profile')
  async updateProfile(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    if (dto.profilePhoto && dto.profilePhoto.length > 2_000_000) {
      throw new Error('Photo too large - please choose a smaller image');
    }
    const patch: Partial<User> = {};
    if (dto.fullName !== undefined) patch.fullName = dto.fullName;
    if (dto.email !== undefined) patch.email = dto.email?.toLowerCase() ?? null;
    if (dto.profilePhoto !== undefined) patch.profilePhoto = dto.profilePhoto;
    await this.usersService.update(user.id, patch);
    const driver = await this.driversService.findByUserId(user.id);
    const fresh = await this.usersService.findById(user.id);
    const { passwordHash, twofaSecret, lastDeviceId, ...safeUser } = fresh ?? user;
    void passwordHash;
    void twofaSecret;
    void lastDeviceId;
    return { user: safeUser, driver };
  }

  @Post('profile')
  createProfile(@CurrentUser() user: User) {
    return this.driversService.createDriverProfile(user, true);
  }

  @Get('available-rides')
  availableRides() {
    return this.ridesService.listByStatus('searching');
  }

  @Post('kyc')
  submitKyc(@CurrentUser() user: User, @Body() body: Record<string, string>) {
    return this.driversService.submitKyc(user.id, body);
  }

  @Post('vehicles')
  registerVehicle(@CurrentUser() user: User, @Body() dto: RegisterVehicleDto) {
    return this.driversService.registerVehicle(user.id, dto);
  }

  @Post('go-online')
  goOnline(@CurrentUser() user: User, @Body() body: { latitude?: number; longitude?: number }) {
    return this.driversService.goOnline(user.id, body.latitude, body.longitude);
  }

  @Post('go-offline')
  goOffline(@CurrentUser() user: User) {
    return this.driversService.goOffline(user.id);
  }

  @Put('location')
  updateLocation(@CurrentUser() user: User, @Body() body: { latitude: number; longitude: number }) {
    return this.driversService.updateLocation(user.id, body.latitude, body.longitude);
  }

  @Get('earnings')
  earnings(@CurrentUser() user: User) {
    return this.driversService.earningsSummary(user.id);
  }
}
