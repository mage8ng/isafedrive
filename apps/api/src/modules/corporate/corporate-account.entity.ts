import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';import { User } from '../users/user.entity';

@Entity('corporate_accounts')
export class CorporateAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  name: string;

  @Index()
  @ManyToOne(() => User)
  @JoinColumn({ name: 'admin_user_id' })
  adminUser: User;

  @Column({ type: 'bigint', default: 0 })
  balance: number;

  @Column({ name: 'cost_centers', type: 'jsonb', nullable: true })
  costCenters: string[] | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('corporate_employees')
export class CorporateEmployee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => CorporateAccount)
  @JoinColumn({ name: 'account_id' })
  account: CorporateAccount;

  @Index()
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'per_ride_limit', type: 'bigint', nullable: true })
  perRideLimit: number | null;

  @Column({ name: 'monthly_limit', type: 'bigint', nullable: true })
  monthlyLimit: number | null;

  @Column({ type: 'varchar', nullable: true })
  department: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
