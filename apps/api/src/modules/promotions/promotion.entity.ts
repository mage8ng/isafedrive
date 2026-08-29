import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type PromotionType =
  | 'percentage'
  | 'fixed_amount'
  | 'first_ride'
  | 'referral'
  | 'driver_bonus';

@Entity('promotions')
export class Promotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  code: string;

  @Column({ type: 'varchar' })
  type: PromotionType;

  @Column({ type: 'bigint' })
  value: number;

  @Column({ name: 'minimum_ride_amount', type: 'bigint', default: 0 })
  minimumRideAmount: number;

  @Column({ name: 'maximum_discount', type: 'bigint', default: 5000 })
  maximumDiscount: number;

  @Column({ name: 'usage_limit', type: 'int', default: 10000 })
  usageLimit: number;

  @Column({ name: 'used_count', type: 'int', default: 0 })
  usedCount: number;

  @Column({ name: 'per_user_limit', type: 'int', default: 1 })
  perUserLimit: number;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'varchar', default: 'active' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
