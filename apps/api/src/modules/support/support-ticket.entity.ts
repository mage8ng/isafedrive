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

export type TicketCategory =
  | 'payment'
  | 'driver'
  | 'passenger'
  | 'ride'
  | 'lost_property'
  | 'technical'
  | 'safety';

@Entity('support_tickets')
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Ride, { nullable: true })
  @JoinColumn({ name: 'ride_id' })
  ride: Ride | null;

  @Column({ type: 'varchar' })
  category: TicketCategory;

  @Column({ type: 'varchar' })
  subject: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', default: 'medium' })
  priority: 'low' | 'medium' | 'high' | 'urgent';

  @Column({ type: 'varchar', default: 'open' })
  status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';

  @Index()
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_admin_id' })
  assignedAdmin: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
}
