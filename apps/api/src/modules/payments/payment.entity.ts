import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Ride } from '../rides/ride.entity';
import { User } from '../users/user.entity';

export type PaymentProvider = 'paystack' | 'flutterwave' | 'cash' | 'wallet';
export type PaymentStatus =
  | 'initialized'
  | 'pending'
  | 'success'
  | 'failed'
  | 'refunded';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Ride)
  @JoinColumn({ name: 'ride_id' })
  ride: Ride | null;

  @Index()
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'bigint' })
  amount: number;

  @Column({ type: 'varchar', default: 'NGN' })
  currency: string;

  @Column({ type: 'varchar' })
  provider: PaymentProvider;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  reference: string;

  @Column({ type: 'varchar', default: 'initialized' })
  status: PaymentStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
