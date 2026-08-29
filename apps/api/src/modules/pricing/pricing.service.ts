import { Injectable } from '@nestjs/common';
import {
  PRICING,
  VEHICLE_CATEGORIES,
  VehicleCategory,
  VehicleCategoryId,
  calculateFare,
} from '@isafedrive/shared';

export interface FareEstimateInput {
  categoryId: VehicleCategoryId;
  distanceKm: number;
  durationMinutes: number;
  surgeMultiplier?: number;
  applyBookingFee?: boolean;
}

@Injectable()
export class PricingService {
  getCategory(categoryId: string): VehicleCategory | undefined {
    return VEHICLE_CATEGORIES.find((c) => c.id === categoryId);
  }

  listCategories(): VehicleCategory[] {
    return VEHICLE_CATEGORIES;
  }

  estimate(input: FareEstimateInput) {
    const category = this.getCategory(input.categoryId);
    if (!category) throw new Error(`Unknown vehicle category: ${input.categoryId}`);
    return calculateFare({
      category,
      distanceKm: input.distanceKm,
      durationMinutes: input.durationMinutes,
      surgeMultiplier:
        input.surgeMultiplier ?? this.currentSurgeMultiplier(),
      applyBookingFee: input.applyBookingFee ?? true,
    });
  }

  currentSurgeMultiplier(supplyDemandRatio = 1): number {
    if (!PRICING.surge.enabled) return 1;
    let multiplier: number = PRICING.surge.minimumMultiplier;
    for (const rule of PRICING.surge.rules) {
      if (supplyDemandRatio >= rule.supplyDemandRatio) {
        multiplier = rule.multiplier;
      }
    }
    return Math.min(multiplier, PRICING.surge.maximumMultiplier);
  }

  cancellationFee(): number {
    return PRICING.cancellationFee;
  }
}
