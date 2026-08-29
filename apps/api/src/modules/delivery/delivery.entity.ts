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

export type DeliveryStatus =
  | 'requested'
  | 'driver_assigned'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export type PackageSize = 'small' | 'medium' | 'large';

@Entity('deliveries')
export class Delivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => User)
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Index()
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'driver_id' })
  driver: User | null;

  @Column({ name: 'recipient_name', type: 'varchar' })
  recipientName: string;

  @Column({ name: 'recipient_phone', type: 'varchar' })
  recipientPhone: string;

  @Column({ name: 'pickup_address', type: 'varchar' })
  pickupAddress: string;

  @Column({ name: 'pickup_latitude', type: 'double precision' })
  pickupLatitude: number;

  @Column({ name: 'pickup_longitude', type: 'double precision' })
  pickupLongitude: number;

  @Column({ name: 'dropoff_address', type: 'varchar' })
  dropoffAddress: string;

  @Column({ name: 'dropoff_latitude', type: 'double precision' })
  dropoffLatitude: number;

  @Column({ name: 'dropoff_longitude', type: 'double precision' })
  dropoffLongitude: number;

  @Column({ name: 'package_name', type: 'varchar' })
  packageName: string;

  @Column({ type: 'varchar', default: 'small' })
  size: PackageSize;

  @Column({ type: 'bigint' })
  fee: number;

  @Column({ type: 'varchar', default: 'requested' })
  status: DeliveryStatus;

  @Column({ name: 'proof_otp', type: 'varchar', length: 4 })
  proofOtp: string;

  @Column({ name: 'proof_photo', type: 'text', nullable: true })
  proofPhoto: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;
}
