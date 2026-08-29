import { Body, Controller, Headers, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  AdminLoginDto,
  LoginDto,
  QuickLoginDto,
  RefreshDto,
  RegisterDto,
  SendOtpDto,
  Verify2faDto,
  VerifyOtpDto,
  SendEmailOtpDto,
  VerifyEmailOtpDto,
  GoogleLoginDto,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Headers('x-device-id') deviceId?: string) {
    return this.authService.login(dto, deviceId);
  }

  @Post('admin-login')
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto.username, dto.password, dto.token);
  }

  @Post('quick-login')
  quickLogin(
    @Body() dto: QuickLoginDto,
    @Headers('x-device-id') deviceId?: string,
  ) {
    return this.authService.quickLogin(dto.phone, dto.fullName, deviceId, dto.role);
  }

  @Post('send-otp')
  sendOtp(@Body() dto: SendOtpDto) {
    this.authService.sendOtp(dto.phone);
    return { sent: true };
  }

  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phone, dto.code);
  }

  @Post('send-email-otp')
  sendEmailOtp(@Body() dto: SendEmailOtpDto) {
    return this.authService.sendEmailOtp(dto.email);
  }

  @Post('verify-email-otp')
  verifyEmailOtp(@Body() dto: VerifyEmailOtpDto) {
    return this.authService.verifyEmailOtp(dto.email, dto.code);
  }

  @Post('google')
  googleLogin(@Body() dto: GoogleLoginDto) {
    return this.authService.googleLogin(dto.idToken, dto.role);
  }

  @Post('verify-2fa')
  verify2fa(@Body() dto: Verify2faDto) {
    return this.authService.verify2fa(dto.phone, dto.token);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    const payload = this.authService.verifyRefreshToken(dto.refreshToken);
    return this.authService.issueTokens({
      id: payload.sub,
      role: payload.role,
      phone: '',
    } as never);
  }

  @Post('logout')
  logout() {
    return { success: true };
  }
}
