import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  COMMISSION,
  WALLET_LIMITS,
} from '@isafedrive/shared';
import { Wallet } from './wallet.entity';
import { WalletTransaction, WalletTransactionType } from './wallet-transaction.entity';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private walletsRepository: Repository<Wallet>,
    private dataSource: DataSource,
  ) {}

  async ensureWallet(userId: string): Promise<Wallet> {
    let wallet = await this.walletsRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!wallet) {
      wallet = this.walletsRepository.create({ user: { id: userId } as never });
      wallet = await this.walletsRepository.save(wallet);
    }
    return wallet;
  }

  async getBalance(userId: string): Promise<Wallet> {
    return this.ensureWallet(userId);
  }

  async applyTransaction(
    userId: string,
    type: WalletTransactionType,
    amount: number,
    description?: string,
    forceDebit = false,
  ): Promise<WalletTransaction> {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');
    const isDebit =
      forceDebit ||
      type === 'withdrawal' ||
      type === 'ride_payment' ||
      type === 'commission';

    return this.dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(Wallet, {
        where: { user: { id: userId } },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) throw new BadRequestException('Wallet not found');

      const delta = isDebit ? -amount : amount;
      const balanceBefore = Number(wallet.balance);
      const balanceAfter = balanceBefore + delta;
      if (isDebit && balanceAfter < 0) {
        throw new BadRequestException('Insufficient wallet balance');
      }
      wallet.balance = balanceAfter;
      await manager.save(wallet);

      const tx = manager.create(WalletTransaction, {
        wallet,
        type,
        amount,
        balanceBefore,
        balanceAfter,
        reference: randomUUID(),
        description: description ?? null,
      });
      return manager.save(tx);
    });
  }

  async deposit(userId: string, amount: number) {
    return this.applyTransaction(userId, 'deposit', amount, 'Wallet deposit');
  }

  async withdrawToBank(userId: string, amount: number) {
    if (amount < WALLET_LIMITS.driverMinimumWithdrawal) {
      throw new BadRequestException(
        `Minimum withdrawal is NGN ${WALLET_LIMITS.driverMinimumWithdrawal}`,
      );
    }
    return this.applyTransaction(userId, 'withdrawal', amount, 'Withdrawal to bank');
  }

  platformCommission(fare: number): { commission: number; driverEarnings: number } {
    const commission = Math.round((fare * COMMISSION.platformPercentage) / 100);
    return { commission, driverEarnings: fare - commission };
  }

  adminAdjustment(userId: string, amount: number, reason: string) {
    if (amount === 0) throw new BadRequestException('Amount cannot be zero');
    return amount > 0
      ? this.applyTransaction(userId, 'adjustment', amount, reason)
      : this.applyTransaction(userId, 'adjustment', Math.abs(amount), reason, true);
  }

  listWallets(): Promise<Wallet[]> {
    return this.walletsRepository
      .createQueryBuilder('wallet')
      .leftJoinAndSelect('wallet.user', 'user')
      .orderBy('wallet.balance', 'DESC')
      .take(200)
      .getMany();
  }

  totalFloat(): Promise<number> {
    return this.walletsRepository
      .createQueryBuilder('wallet')
      .select('COALESCE(SUM(wallet.balance), 0)', 'total')
      .getRawOne()
      .then((r) => Number(r?.total ?? 0));
  }
}
