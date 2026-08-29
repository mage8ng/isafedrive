import { BadRequestException, Injectable } from '@nestjs/common';
import { OTP_CONFIG } from '@isafedrive/shared';

interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

@Injectable()
export class OtpService {
  private store = new Map<string, OtpEntry>();

  generate(phone: string): string {
    const code = Math.floor(Math.random() * 10 ** OTP_CONFIG.length)
      .toString()
      .padStart(OTP_CONFIG.length, '0');
    this.store.set(phone, {
      code,
      attempts: 0,
      expiresAt: Date.now() + OTP_CONFIG.expirySeconds * 1000,
    });
    this.deliver(phone, code);
    return code;
  }

  verify(phone: string, code: string): boolean {
    const entry = this.store.get(phone);
    if (!entry) throw new BadRequestException('No OTP requested');
    if (Date.now() > entry.expiresAt) {
      this.store.delete(phone);
      throw new BadRequestException('OTP expired');
    }
    entry.attempts += 1;
    if (entry.attempts > OTP_CONFIG.maxAttempts) {
      this.store.delete(phone);
      throw new BadRequestException('Too many attempts');
    }
    if (entry.code !== code) throw new BadRequestException('Invalid OTP');
    this.store.delete(phone);
    return true;
  }

  private deliver(phone: string, code: string) {
    process.stdout.write(`[SMS] OTP for ${phone}: ${code}\n`);
  }
}
