import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from '@isafedrive/shared';

export class RegisterDto {
  @IsString()
  fullName: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsEnum(['passenger', 'driver'])
  role?: UserRole;
}

export class LoginDto {
  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  password?: string;
}

export class SendOtpDto {
  @IsString()
  phone: string;
}

export class VerifyOtpDto {
  @IsString()
  phone: string;

  @IsString()
  code: string;
}

export class Verify2faDto {
  @IsString()
  phone: string;

  @IsString()
  token: string;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;
}

export class AdminLoginDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(4)
  password: string;

  @IsOptional()
  @IsString()
  token?: string;
}

export class QuickLoginDto {
  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsIn(['passenger', 'driver'])
  role?: 'passenger' | 'driver';
}

export class SendEmailOtpDto {
  @IsString()
  email: string;
}

export class VerifyEmailOtpDto {
  @IsString()
  email: string;

  @IsString()
  code: string;
}

export class GoogleLoginDto {
  @IsString()
  idToken: string;

  @IsOptional()
  @IsIn(['passenger', 'driver'])
  role?: 'passenger' | 'driver';
}
