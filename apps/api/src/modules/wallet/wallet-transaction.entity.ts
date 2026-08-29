import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Wallet } from './wallet.entity';

export type WalletTransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'ride_payment'
  | 'refund'
  | 'commission'
  | 'bonus'
  | 'tip'
  | 'adjustment';

@Entity('wallet_transactions')
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Wallet)
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;

  @Column({ type: 'varchar' })
  type: WalletTransactionType;

  @Column({ type: 'bigint' })
  amount: number;

  @Column({ name: 'balance_before', type: 'bigint' })
  balanceBefore: number;

  @Column({ name: 'balance_after', type: 'bigint' })
  balanceAfter: number;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  reference: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
