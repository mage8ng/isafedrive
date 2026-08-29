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

export type FraudSeverity = 'low' | 'medium' | 'high' | 'critical';

@Entity('fraud_alerts')
export class FraudAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar' })
  rule: string;

  @Column({ type: 'varchar', default: 'medium' })
  severity: FraudSeverity;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null;

  @Column({ type: 'varchar', default: 'open' })
  status: 'open' | 'investigating' | 'resolved';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
