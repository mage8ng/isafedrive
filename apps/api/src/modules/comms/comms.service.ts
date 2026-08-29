import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { RidesService } from '../rides/rides.service';

export interface MaskedContact {
  alias: string;
  maskedFor: string;
  expiresWithRide: boolean;
  provider: string;
}

export interface CommsProvider {
  readonly name: string;
  maskedContact(rideId: string, aPhone: string, bPhone: string): Promise<MaskedContact>;
  sendSms(phone: string, text: string): Promise<void>;
}

export class ConsoleCommsProvider implements CommsProvider {
  readonly name = 'console';
  private readonly logger = new Logger('Comms');

  async maskedContact(rideId: string, aPhone: string, bPhone: string): Promise<MaskedContact> {
    const alias = `+234700${rideId.replaceAll('-', '').slice(0, 7)}`;
    this.logger.log(
      `[MASKED] ${aPhone} <-> ${bPhone} via virtual number ${alias} (ride ${rideId})`,
    );
    return { alias, maskedFor: `${aPhone}/${bPhone}`, expiresWithRide: true, provider: this.name };
  }

  async sendSms(phone: string, text: string) {
    this.logger.log(`[SMS] to ${phone}: ${text}`);
  }
}

export class TwilioCommsProvider implements CommsProvider {
  readonly name = 'twilio';
  private readonly logger = new Logger('Comms');

  constructor(
    private accountSid: string,
    private authToken: string,
    private fromNumber: string,
  ) {}

  async maskedContact(rideId: string, aPhone: string, bPhone: string): Promise<MaskedContact> {
    void rideId;
    void aPhone;
    void bPhone;
    return {
      alias: this.fromNumber,
      maskedFor: 'twilio-proxy',
      expiresWithRide: false,
      provider: this.name,
    };
  }

  async sendSms(phone: string, text: string) {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: phone, From: this.fromNumber, Body: text }),
      },
    );
    if (!res.ok) {
      this.logger.error(`Twilio SMS failed (${res.status}) to ${phone}`);
    }
  }
}

@Injectable()
export class CommsService {
  private provider: CommsProvider;

  constructor(private ridesService: RidesService) {
    this.provider =
      process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
        ? new TwilioCommsProvider(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN,
            process.env.TWILIO_FROM_NUMBER ?? '',
          )
        : new ConsoleCommsProvider();
  }

  async maskedContactForRide(userPhone: string, rideId: string): Promise<MaskedContact> {
    const ride = await this.ridesService.findById(rideId);
    const other = ride.passenger.phone === userPhone ? ride.driver?.phone : ride.passenger.phone;
    if (!other) throw new NotFoundException('No counterparty on this ride yet');
    return this.provider.maskedContact(rideId, userPhone, other);
  }

  async sendSms(phone: string, text: string) {
    await this.provider.sendSms(phone, text);
  }
}

export function generateVirtualAlias(): string {
  return `+234700${randomBytes(4).toString('hex').slice(0, 7)}`;
}
