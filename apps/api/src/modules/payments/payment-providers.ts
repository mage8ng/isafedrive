import { createHmac, timingSafeEqual } from 'crypto';

export interface InitializeResult {
  authorizationUrl?: string;
  reference: string;
  raw: unknown;
}

export interface PaymentProviderClient {
  name: string;
  initialize(params: {
    amountNaira: number;
    email: string;
    reference: string;
    callbackUrl?: string;
  }): Promise<InitializeResult>;
  verifyWebhookSignature(headers: Record<string, string>, rawBody: Buffer): boolean;
}

export class PaystackProvider implements PaymentProviderClient {
  name = 'paystack';

  constructor(private secretKey: string) {}

  async initialize(params: {
    amountNaira: number;
    email: string;
    reference: string;
    callbackUrl?: string;
  }): Promise<InitializeResult> {
    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: params.email,
        amount: params.amountNaira * 100,
        reference: params.reference,
        callback_url: params.callbackUrl,
      }),
    });
    const json = (await res.json()) as {
      status: boolean;
      data?: { authorization_url?: string };
      message?: string;
    };
    if (!json.status) throw new Error(json.message ?? 'Paystack init failed');
    return {
      authorizationUrl: json.data?.authorization_url,
      reference: params.reference,
      raw: json,
    };
  }

  verifyWebhookSignature(
    headers: Record<string, string>,
    rawBody: Buffer,
  ): boolean {
    const signature = headers['x-paystack-signature'];
    if (!signature) return false;
    const expected = createHmac('sha512', this.secretKey)
      .update(rawBody)
      .digest('hex');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

export class FlutterwaveProvider implements PaymentProviderClient {
  name = 'flutterwave';

  constructor(private secretKey: string, private secretHash: string) {}

  async initialize(params: {
    amountNaira: number;
    email: string;
    reference: string;
    callbackUrl?: string;
  }): Promise<InitializeResult> {
    const res = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: params.reference,
        amount: params.amountNaira,
        currency: 'NGN',
        redirect_url: params.callbackUrl,
        customer: { email: params.email },
      }),
    });
    const json = (await res.json()) as {
      status: string;
      data?: { link?: string };
      message?: string;
    };
    if (json.status !== 'success') {
      throw new Error(json.message ?? 'Flutterwave init failed');
    }
    return {
      authorizationUrl: json.data?.link,
      reference: params.reference,
      raw: json,
    };
  }

  verifyWebhookSignature(
    headers: Record<string, string>,
    _rawBody: Buffer,
  ): boolean {
    void _rawBody;
    const verifHash = headers['verif-hash'];
    if (!verifHash || !this.secretHash) return false;
    const a = Buffer.from(verifHash);
    const b = Buffer.from(this.secretHash);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
