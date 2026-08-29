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

@Entity('fleets')
export class Fleet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  name: string;

  @Index()
  @ManyToOne(() => User)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ name: 'commission_percent', type: 'numeric', precision: 5, scale: 2, default: 10 })
  commissionPercent: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('fleet_drivers')
export class FleetDriver {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Fleet)
  @JoinColumn({ name: 'fleet_id' })
  fleet: Fleet;

  @Index()
  @ManyToOne(() => User)
  @JoinColumn({ name: 'driver_user_id' })
  driverUser: User;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;
}
