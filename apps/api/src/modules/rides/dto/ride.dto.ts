import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { VEHICLE_CATEGORY_IDS } from '@isafedrive/shared';

export class EstimateRideDto {
  @IsIn(VEHICLE_CATEGORY_IDS)
  categoryId: (typeof VEHICLE_CATEGORY_IDS)[number];

  @IsNumber() pickupLatitude: number;
  @IsNumber() pickupLongitude: number;
  @IsNumber() destinationLatitude: number;
  @IsNumber() destinationLongitude: number;
}

export class StopDto {
  @IsString() address: string;
  @IsNumber() latitude: number;
  @IsNumber() longitude: number;
}

export class CreateRideDto {
  @IsIn(VEHICLE_CATEGORY_IDS)
  categoryId: (typeof VEHICLE_CATEGORY_IDS)[number];

  @IsString() pickupAddress: string;
  @IsNumber() pickupLatitude: number;
  @IsNumber() pickupLongitude: number;

  @IsString() destinationAddress: string;
  @IsNumber() destinationLatitude: number;
  @IsNumber() destinationLongitude: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StopDto)
  stops?: StopDto[];

  @IsOptional()
  @IsString() paymentMethod?: string;

  @IsOptional()
  @IsString() promoCode?: string;

  @IsOptional()
  @IsString() note?: string;

  @IsOptional()
  @IsString() corporateAccountId?: string;

  @IsOptional()
  @IsString() costCenter?: string;

  @IsOptional()
  scheduledAt?: Date;
}

export class RateRideDto {
  @Min(1) @Max(5)
  rating: number;

  @IsOptional()
  @IsString() comment?: string;
}
