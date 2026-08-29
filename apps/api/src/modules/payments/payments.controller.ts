import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { PaymentsService } from './payments.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '../users/user.entity';

class InitializePaymentDto {
  @IsNumber() @Min(100)
  amount: number;

  @IsEnum(['paystack', 'flutterwave'])
  provider: 'paystack' | 'flutterwave';

  @IsOptional()
  @IsNumber()
  rideId?: string;

  @IsOptional()
  callbackUrl?: string;
}

@Controller()
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('payments/initialize')
  @UseGuards(AuthGuard('jwt'))
  initialize(@CurrentUser() user: User, @Body() dto: InitializePaymentDto) {
    return this.paymentsService.initialize(user.id, dto);
  }

  @Post('payments/webhook/:provider')
  webhook(
    @Param('provider') provider: 'paystack' | 'flutterwave',
    @Req() req: RawBodyRequest<Request>,
  ) {
    const rawBody = (req.body ?? Buffer.alloc(0)) as Buffer;
    const headers = Object.fromEntries(
      Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : String(v ?? '')]),
    ) as Record<string, string>;
    return this.paymentsService.handleWebhook(provider, headers, rawBody);
  }

  @Get('payments')
  @UseGuards(AuthGuard('jwt'))
  list(@Query() query: Record<string, string>) {
    void query;
    return this.paymentsService.list();
  }
}
