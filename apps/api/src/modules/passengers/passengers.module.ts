import { Body, Controller, Get, Injectable, Module, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User as UserType } from '../users/user.entity';

export function sanitizeUser(user: UserType) {
  const { passwordHash, twofaSecret, lastDeviceId, ...safe } = user;
  void passwordHash;
  void twofaSecret;
  void lastDeviceId;
  return safe;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  @IsEmail({}, { message: 'Invalid email' })
  email?: string;

  @IsOptional()
  @IsString()
  profilePhoto?: string;
}

@Injectable()
export class PassengersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async getProfile(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    return sanitizeUser(user);
  }

  async updateProfile(userId: string, data: UpdateProfileDto) {
    if (data.profilePhoto && data.profilePhoto.length > 2_000_000) {
      throw new Error('Photo too large - please choose a smaller image');
    }
    const patch: Partial<User> = {};
    if (data.fullName !== undefined) patch.fullName = data.fullName;
    if (data.email !== undefined) patch.email = data.email?.toLowerCase() ?? null;
    if (data.profilePhoto !== undefined) patch.profilePhoto = data.profilePhoto;
    await this.usersRepository.update(userId, patch);
    return this.getProfile(userId);
  }
}

@Controller('passengers')
@UseGuards(AuthGuard('jwt'))
export class PassengersController {
  constructor(private passengersService: PassengersService) {}

  @Get('profile')
  profile(@CurrentUser() user: UserType) {
    return this.passengersService.getProfile(user.id);
  }

  @Put('profile')
  update(@CurrentUser() user: UserType, @Body() dto: UpdateProfileDto) {
    return this.passengersService.updateProfile(user.id, dto);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [PassengersController],
  providers: [PassengersService],
  exports: [PassengersService],
})
export class PassengersModule {}
