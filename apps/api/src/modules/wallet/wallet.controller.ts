import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsNumber, Min } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WalletService } from './wallet.service';
import { DriverWithdrawal } from './driver-withdrawal.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import type { User } from '../users/user.entity';

class DepositDto {
  @IsNumber()
  @Min(100)
  amount: number;
}

class WithdrawDto extends DepositDto {
  bankName!: string;
  accountNumber!: string;
  accountName!: string;
}

@Controller()
@UseGuards(AuthGuard('jwt'))
export class WalletController {
  constructor(
    private walletService: WalletService,
    @InjectRepository(DriverWithdrawal)
    private withdrawalsRepository: Repository<DriverWithdrawal>,
  ) {}

  @Get('passengers/wallet')
  passengerWallet(@CurrentUser() user: User) {
    return this.walletService.getBalance(user.id);
  }

  @Post('passengers/wallet/deposit')
  deposit(@CurrentUser() user: User, @Body() dto: DepositDto) {
    return this.walletService.deposit(user.id, dto.amount);
  }

  @Get('drivers/wallet')
  driverWallet(@CurrentUser() user: User) {
    return this.walletService.getBalance(user.id);
  }

  @Post('drivers/withdraw')
  async withdraw(@CurrentUser() user: User, @Body() dto: WithdrawDto) {
    const tx = await this.walletService.withdrawToBank(user.id, dto.amount);
    const withdrawal = this.withdrawalsRepository.create({
      driver: { id: user.id } as never,
      amount: dto.amount,
      bankName: dto.bankName,
      accountNumber: dto.accountNumber,
      accountName: dto.accountName,
      reference: tx.reference ?? randomUUID(),
      status: 'pending',
    });
    return this.withdrawalsRepository.save(withdrawal);
  }
}
