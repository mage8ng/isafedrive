import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RideStatus, VehicleCategoryId } from '@isafedrive/shared';
import { User } from '../users/user.entity';
import { Vehicle } from '../drivers/vehicle.entity';
import { CorporateAccount } from '../corporate/corporate-account.entity';

@Entity('rides')
export class Ride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => User)
  @JoinColumn({ name: 'passenger_id' })
  passenger: User;

  @Index()
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'driver_id' })
  driver: User | null;

  @ManyToOne(() => Vehicle, { nullable: true })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle | null;

  @Column({ name: 'pickup_address', type: 'varchar' })
  pickupAddress: string;

  @Column({ name: 'pickup_latitude', type: 'double precision' })
  pickupLatitude: number;

  @Column({ name: 'pickup_longitude', type: 'double precision' })
  pickupLongitude: number;

  @Column({ name: 'destination_address', type: 'varchar' })
  destinationAddress: string;

  @Column({ name: 'destination_latitude', type: 'double precision' })
  destinationLatitude: number;

  @Column({ name: 'destination_longitude', type: 'double precision' })
  destinationLongitude: number

  @Column({ type: 'jsonb', nullable: true })
  stops: { address: string; latitude: number; longitude: number }[] | null;

  @Column({ name: 'distance_km', type: 'double precision', nullable: true })
  distanceKm: number | null;

  @Column({ name: 'duration_minutes', type: 'int', nullable: true })
  durationMinutes: number | null;

  @Column({ name: 'category_id', type: 'varchar' })
  categoryId: VehicleCategoryId;

  @Column({ type: 'bigint', default: 0 })
  fare: number;

  @Column({ type: 'numeric', precision: 3, scale: 2, default: 1.0 })
  surgeMultiplier: number;

  @Column({ type: 'varchar', default: 'requested' })
  status: RideStatus;

  @Column({ name: 'payment_method', type: 'varchar', default: 'cash' })
  paymentMethod: string;

  @Column({ name: 'payment_status', type: 'varchar', default: 'pending' })
  paymentStatus: string;

  @Column({ name: 'ride_pin', type: 'varchar', length: 4 })
  ridePin: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'promo_code', type: 'varchar', nullable: true })
  promoCode: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledAt: Date | null;

  @Column({ name: 'requested_at', type: 'timestamptz', default: () => 'now()' })
  requestedAt: Date;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'cancelled_by', type: 'varchar', nullable: true })
  cancelledBy: string | null;

  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason: string | null;

  @Column({ name: 'pickup_zone', type: 'varchar', nullable: true })
  pickupZone: string | null;

  @Index()
  @ManyToOne(() => CorporateAccount, { nullable: true })
  @JoinColumn({ name: 'corporate_account_id' })
  corporateAccount: CorporateAccount | null;

  @Column({ name: 'cost_center', type: 'varchar', nullable: true })
  costCenter: string | null;
}
