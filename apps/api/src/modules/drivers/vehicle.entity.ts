import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Driver } from './driver.entity';
import { VehicleCategoryId } from '@isafedrive/shared';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => Driver)
  @JoinColumn({ name: 'driver_id' })
  driver: Driver;

  @Column({ name: 'category_id', type: 'varchar' })
  categoryId: VehicleCategoryId;

  @Column({ type: 'varchar' })
  make: string;

  @Column({ type: 'varchar' })
  model: string;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'varchar' })
  color: string;

  @Index({ unique: true })
  @Column({ name: 'plate_number', type: 'varchar' })
  plateNumber: string;

  @Column({ name: 'registration_number', type: 'varchar', nullable: true })
  registrationNumber: string | null;

  @Column({ name: 'insurance_expiry', type: 'date', nullable: true })
  insuranceExpiry: Date | null;

  @Column({ name: 'roadworthiness_expiry', type: 'date', nullable: true })
  roadworthinessExpiry: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  photos: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  documents: Record<string, string> | null;

  @Column({ type: 'varchar', default: 'pending_review' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
