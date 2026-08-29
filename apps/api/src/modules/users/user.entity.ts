import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '@isafedrive/shared';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  role: UserRole;

  @Index()
  @Column({ name: 'full_name', type: 'varchar', nullable: true })
  fullName: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  username: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  phone: string;

  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash: string | null;

  @Column({ name: 'profile_photo', type: 'text', nullable: true })
  profilePhoto: string | null;

  @Column({ type: 'varchar', default: 'active' })
  status: string;

  @Column({ type: 'numeric', precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column({ name: 'twofa_secret', type: 'varchar', nullable: true, select: false })
  twofaSecret: string | null;

  @Column({ name: 'twofa_enabled', type: 'boolean', default: false })
  twofaEnabled: boolean;

  @Column({ name: 'last_device_id', type: 'varchar', nullable: true })
  lastDeviceId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
