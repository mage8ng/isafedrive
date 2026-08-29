import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@isafedrive/shared';
import { OtpService } from './otp.service';
import { generateSecret, otpauthUri, verifyTotp } from './totp';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { UsersService } from '../modules/users/users.service';
import { WalletService } from '../modules/wallet/wallet.service';
import { DriversService } from '../modules/drivers/drivers.service';
import type { User } from '../modules/users/user.entity';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private otpService: OtpService,
    private walletService: WalletService,
    private driversService: DriversService,
  ) {}

  sendOtp(phone: string): void {
    this.otpService.generate(phone);
  }

  async sendEmailOtp(email: string): Promise<{ sent: boolean }> {
    this.otpService.generate(email.toLowerCase());
    return { sent: true };
  }

  async verifyEmailOtp(email: string, code: string) {
    this.otpService.verify(email.toLowerCase(), code);
    let user = await this.usersService.findByEmail(email);
    if (!user) {
      user = await this.usersService.create({
        email: email.toLowerCase(),
        role: 'passenger',
      });
      await this.walletService.ensureWallet(user.id);
    }
    return this.issueTokens(user);
  }

  async googleLogin(idToken: string, role: 'passenger' | 'driver' = 'passenger') {
    let payload: { email?: string; name?: string; aud?: string };
    try {
      const part = idToken.split('.')[1];
      payload = JSON.parse(Buffer.from(part, 'base64').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }
    const email = (payload.email || '').toLowerCase();
    if (!email) throw new UnauthorizedException('Google account has no email');
    if (process.env.GOOGLE_CLIENT_ID && payload.aud !== process.env.GOOGLE_CLIENT_ID) {
      throw new UnauthorizedException('Google token audience mismatch');
    }
    let user = await this.usersService.findByEmail(email);
    if (!user) {
      user = await this.usersService.create({
        email,
        fullName: payload.name ?? null,
        role: role === 'driver' ? 'driver' : 'passenger',
      });
      await this.walletService.ensureWallet(user.id);
      if (role === 'driver') {
        await this.driversService.createDriverProfile(user, true);
      }
    }
    return this.issueTokens(user);
  }

  verifyOtp(phone: string, code: string) {
    this.otpService.verify(phone, code);
    return this.issueTokensAfterOtp(phone);
  }

  private async issueTokensAfterOtp(phone: string) {
    const user = await this.usersService.findByPhoneWithSecret(phone);
    if (!user) return this.issueTokensForPhone(phone);
    if (user.twofaEnabled && user.twofaSecret) {
      return { twoFaRequired: true, phone };
    }
    return this.issueTokens(user);
  }

  async adminLogin(username: string, password: string, twoFaToken?: string) {
    const user = await this.usersService.findByUsernameWithSecret(username);
    if (!user) throw new UnauthorizedException('Invalid username or password');
    if (!['admin', 'super_admin'].includes(user.role)) {
      throw new UnauthorizedException('Account is not an administrator');
    }
    if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid username or password');
    }
    if (user.twofaEnabled && user.twofaSecret) {
      if (!twoFaToken || !verifyTotp(user.twofaSecret, twoFaToken)) {
        throw new UnauthorizedException('Valid 2FA code required');
      }
    }
    return this.issueTokens(user);
  }

  async verify2fa(phone: string, token: string) {
    const user = await this.usersService.findByPhoneWithSecret(phone);
    if (!user || !user.twofaEnabled || !user.twofaSecret) {
      throw new UnauthorizedException('2FA not enabled');
    }
    if (!verifyTotp(user.twofaSecret, token)) {
      throw new UnauthorizedException('Invalid 2FA code');
    }
    return this.issueTokens(user);
  }

  async setup2fa(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException();
    const secret = generateSecret();
    await this.usersService.update(userId, { twofaSecret: secret, twofaEnabled: false });
    return {
      secret,
      otpauthUrl: otpauthUri(secret, user.phone ?? userId),
    };
  }

  async enable2fa(userId: string, token: string) {
    const user = await this.usersService.findByIdWithSecret(userId);
    if (!user?.twofaSecret) throw new UnauthorizedException('Run setup first');
    if (!verifyTotp(user.twofaSecret, token)) {
      throw new UnauthorizedException('Invalid code - try the next one');
    }
    await this.usersService.update(userId, { twofaEnabled: true });
    return { enabled: true };
  }

  async disable2fa(userId: string, token: string) {
    const user = await this.usersService.findByIdWithSecret(userId);
    if (!user?.twofaSecret) throw new UnauthorizedException('2FA not configured');
    if (!verifyTotp(user.twofaSecret, token)) {
      throw new UnauthorizedException('Invalid code');
    }
    await this.usersService.update(userId, { twofaEnabled: false, twofaSecret: null });
    return { enabled: false };
  }

  async captureDevice(phone: string, deviceId?: string) {
    if (!deviceId) return;
    await this.usersService.findByPhone(phone).then((user) => {
      if (user) return this.usersService.update(user.id, { lastDeviceId: deviceId });
    });
  }

  async quickLogin(
    phone: string,
    fullName?: string,
    deviceId?: string,
    role: 'passenger' | 'driver' = 'passenger',
  ) {
    let user = await this.usersService.findByPhone(phone);
    if (!user) {
      user = await this.usersService.create({
        phone,
        fullName: fullName ?? null,
        role: role === 'driver' ? 'driver' : 'passenger',
      });
      await this.walletService.ensureWallet(user.id);
      if (role === 'driver') {
        await this.driversService.createDriverProfile(user, true);
      }
    }
    await this.captureDevice(phone, deviceId);
    return this.issueTokens(user);
  }

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByPhone(dto.phone);
    if (existing) throw new ConflictException('Phone already registered');

    const role: UserRole = dto.role === 'driver' ? 'driver' : 'passenger';
    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : null;

    const user = await this.usersService.create({
      fullName: dto.fullName,
      phone: dto.phone,
      email: dto.email ?? null,
      passwordHash,
      role,
    });

    if (role === 'driver') {
      await this.driversService.createDriverProfile(user, true);
    }
    await this.walletService.ensureWallet(user.id);

    this.otpService.generate(dto.phone);
    return { userId: user.id, role, otpRequired: true };
  }

  async login(dto: LoginDto, deviceId?: string) {
    const user = await this.usersService.findByPhone(dto.phone);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.passwordHash && dto.password) {
      const ok = await bcrypt.compare(dto.password, user.passwordHash);
      if (!ok) throw new UnauthorizedException('Invalid credentials');
    } else if (user.passwordHash) {
      throw new UnauthorizedException('Password required');
    }
    await this.captureDevice(dto.phone, deviceId);
    return this.issueTokens(user);
  }

  private async issueTokensForPhone(phone: string) {
    let user = await this.usersService.findByPhone(phone);
    if (!user) {
      user = await this.usersService.create({ phone, role: 'passenger' });
      await this.walletService.ensureWallet(user.id);
    }
    return this.issueTokens(user);
  }

  issueTokens(user: User): AuthTokens & { user: Pick<User, 'id' | 'phone' | 'role'> } {
    const payload = { sub: user.id, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ??
          '7d') as never as JwtSignOptions['expiresIn'],
      }),
      user: { id: user.id, phone: user.phone, role: user.role },
    };
  }

  verifyRefreshToken(token: string) {
    try {
      return this.jwtService.verify<{ sub: string; role: string }>(token, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
