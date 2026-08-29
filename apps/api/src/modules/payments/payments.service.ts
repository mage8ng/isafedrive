import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { Payment } from './payment.entity';
import {
  FlutterwaveProvider,
  PaymentProviderClient,
  PaystackProvider,
} from './payment-providers';
import { UsersService } from '../users/users.service';
import { RidesService } from '../rides/rides.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private providers = new Map<string, PaymentProviderClient>();

  constructor(
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    private usersService: UsersService,
    private ridesService: RidesService,
  ) {
    if (process.env.PAYSTACK_SECRET_KEY) {
      this.providers.set('paystack', new PaystackProvider(process.env.PAYSTACK_SECRET_KEY));
    }
    if (process.env.FLUTTERWAVE_SECRET_KEY) {
      this.providers.set(
        'flutterwave',
        new FlutterwaveProvider(
          process.env.FLUTTERWAVE_SECRET_KEY,
          process.env.FLUTTERWAVE_SECRET_HASH ?? '',
        ),
      );
    }
  }

  async initialize(userId: string, params: { rideId?: string; amount: number; provider: 'paystack' | 'flutterwave'; callbackUrl?: string }) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const client = this.providers.get(params.provider);
    if (!client) {
      throw new BadRequestException(`Provider not configured: ${params.provider}`);
    }
    const reference = randomUUID();
    const payment = await this.paymentsRepository.save(
      this.paymentsRepository.create({
        user: { id: userId } as never,
        ride: params.rideId ? ({ id: params.rideId } as never) : null,
        amount: params.amount,
        currency: 'NGN',
        provider: params.provider,
        reference,
        status: 'initialized',
      }),
    );
    const result = await client.initialize({
      amountNaira: params.amount,
      email: user.email ?? `${user.phone}@isafedrive.placeholder`,
      reference,
      callbackUrl: params.callbackUrl,
    });
    payment.status = 'pending';
    await this.paymentsRepository.save(payment);
    return { payment, ...result };
  }

  async handleWebhook(provider: 'paystack' | 'flutterwave', headers: Record<string, string>, rawBody: Buffer) {
    const client = this.providers.get(provider);
    if (!client) throw new BadRequestException('Provider not configured');
    if (!client.verifyWebhookSignature(headers, rawBody)) {
      throw new BadRequestException('Invalid webhook signature');
    }
    const event = JSON.parse(rawBody.toString('utf8')) as Record<string, never>;
    const reference =
      (provider === 'paystack'
        ? ((event.data as Record<string, string>)?.reference)
        : ((event.data as Record<string, string>)?.tx_ref)) ?? '';
    const success =
      provider === 'paystack'
        ? event.event === 'charge.success'
        : event.status === 'successful' || (event.data as Record<string, string>)?.status === 'successful';

    const payment = await this.paymentsRepository.findOne({ where: { reference } });
    if (!payment) {
      this.logger.warn(`Webhook for unknown reference ${reference}`);
      return { handled: false };
    }
    payment.status = success ? 'success' : 'failed';
    await this.paymentsRepository.save(payment);
    if (success && payment.ride) {
      await this.ridesService.findById((payment.ride as { id: string }).id).catch(() => null);
    }
    this.logger.log(`Payment ${reference} marked ${payment.status}`);
    return { handled: true, status: payment.status };
  }

  list(): Promise<Payment[]> {
    return this.paymentsRepository.find({ order: { createdAt: 'DESC' } });
  }
}
