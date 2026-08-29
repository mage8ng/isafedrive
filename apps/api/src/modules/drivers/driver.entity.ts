import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { KycStatus } from '@isafedrive/shared';
import { User } from '../users/user.entity';

@Entity('drivers')
export class Driver {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'license_number', type: 'varchar', nullable: true })
  licenseNumber: string | null;

  @Column({ name: 'license_expiry', type: 'date', nullable: true })
  licenseExpiry: Date | null;

  @Column({ name: 'kyc_status', type: 'varchar', default: 'pending' })
  kycStatus: KycStatus;

  @Column({
    name: 'online_status',
    type: 'varchar',
    default: 'offline',
  })
  onlineStatus: 'online' | 'offline' | 'busy';

  @Column({
    name: 'current_latitude',
    type: 'double precision',
    nullable: true,
  })
  currentLatitude: number | null;

  @Column({
    name: 'current_longitude',
    type: 'double precision',
    nullable: true,
  })
  currentLongitude: number | null;

  @Column({ type: 'numeric', precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column({ name: 'acceptance_rate', type: 'numeric', precision: 5, scale: 2, default: 100 })
  acceptanceRate: number;

  @Column({ name: 'cancellation_rate', type: 'numeric', precision: 5, scale: 2, default: 0 })
  cancellationRate: number;

  @Column({ type: 'jsonb', nullable: true })
  kycDocuments: Record<string, string> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
