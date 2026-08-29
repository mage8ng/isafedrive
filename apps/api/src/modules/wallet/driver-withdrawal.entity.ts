import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('driver_withdrawals')
export class DriverWithdrawal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => User)
  @JoinColumn({ name: 'driver_id' })
  driver: User;

  @Column({ type: 'bigint' })
  amount: number;

  @Column({ name: 'bank_name', type: 'varchar' })
  bankName: string;

  @Column({ name: 'account_number', type: 'varchar' })
  accountNumber: string;

  @Column({ name: 'account_name', type: 'varchar' })
  accountName: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'processing' | 'paid' | 'rejected';

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  reference: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;
}
