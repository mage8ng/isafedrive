import { Module } from '@nestjs/common';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../modules/users/users.module';
import { WalletModule } from '../modules/wallet/wallet.module';
import { DriversModule } from '../modules/drivers/drivers.module';

@Module({
  imports: [
    UsersModule,
    WalletModule,
    DriversModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-access-secret',
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as never as JwtSignOptions['expiresIn'],
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, OtpService],
  exports: [AuthService],
})
export class AuthModule {}
