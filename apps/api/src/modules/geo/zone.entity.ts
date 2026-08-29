import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { City } from './city.entity';

export type ZoneType = 'standard' | 'airport' | 'restricted' | 'surge';

@Entity('zones')
export class Zone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => City)
  @JoinColumn({ name: 'city_id' })
  city: City;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', default: 'standard' })
  type: ZoneType;

  @Column({ name: 'center_latitude', type: 'double precision' })
  centerLatitude: number;

  @Column({ name: 'center_longitude', type: 'double precision' })
  centerLongitude: number;

  @Column({ name: 'radius_km', type: 'double precision', default: 5 })
  radiusKm: number;

  @Column({ name: 'fare_multiplier', type: 'numeric', precision: 4, scale: 2, default: 1 })
  fareMultiplier: number;

  @Column({ name: 'surge_multiplier', type: 'numeric', precision: 4, scale: 2, default: 1 })
  surgeMultiplier: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
