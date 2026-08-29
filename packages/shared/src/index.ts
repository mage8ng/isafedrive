export const APP = {
  name: 'iSafeDrive',
  displayName: 'iSafeDrive Taxi',
  version: '1.0.0',
  market: 'Nigeria',
  currency: 'NGN',
  timezone: 'Africa/Lagos',
} as const;

export type UserRole = 'passenger' | 'driver' | 'admin' | 'super_admin';

export type RideStatus =
  | 'requested'
  | 'searching'
  | 'driver_assigned'
  | 'driver_arriving'
  | 'driver_arrived'
  | 'passenger_onboard'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'disputed';

export type KycStatus =
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'expired';

export type VehicleCategoryId =
  | 'economy'
  | 'comfort'
  | 'xl'
  | 'premium'
  | 'motorcycle'
  | 'tricycle';

export const VEHICLE_CATEGORY_IDS = [
  'economy',
  'comfort',
  'xl',
  'premium',
  'motorcycle',
  'tricycle',
] as const;

export interface VehicleCategory {
  id: VehicleCategoryId;
  name: string;
  description: string;
  capacity: number;
  baseFare: number;
  perKm: number;
  perMinute: number;
  minimumFare: number;
}

export const VEHICLE_CATEGORIES: VehicleCategory[] = [
  { id: 'economy', name: 'iSafe Economy', description: 'Affordable everyday rides', capacity: 4, baseFare: 1000, perKm: 300, perMinute: 50, minimumFare: 1500 },
  { id: 'comfort', name: 'iSafe Comfort', description: 'Comfortable premium vehicles', capacity: 4, baseFare: 1500, perKm: 400, perMinute: 70, minimumFare: 2000 },
  { id: 'xl', name: 'iSafe XL', description: 'Large vehicles for groups', capacity: 6, baseFare: 2000, perKm: 500, perMinute: 80, minimumFare: 2500 },
  { id: 'premium', name: 'iSafe Premium', description: 'Premium transportation', capacity: 4, baseFare: 3000, perKm: 700, perMinute: 100, minimumFare: 4000 },
  { id: 'motorcycle', name: 'iSafe Bike', description: 'Fast motorcycle transportation', capacity: 1, baseFare: 500, perKm: 150, perMinute: 30, minimumFare: 700 },
  { id: 'tricycle', name: 'iSafe Keke', description: 'Tricycle transportation', capacity: 3, baseFare: 700, perKm: 200, perMinute: 40, minimumFare: 1000 },
];

export const PRICING = {
  bookingFee: 200,
  waitingFeePerMinute: 50,
  cancellationFee: 500,
  airportFee: 500,
  tollFeeEnabled: true,
  surge: {
    enabled: true,
    automatic: true,
    minimumMultiplier: 1.0,
    maximumMultiplier: 3.0,
    rules: [
      { supplyDemandRatio: 1.5, multiplier: 1.2 },
      { supplyDemandRatio: 2.0, multiplier: 1.5 },
      { supplyDemandRatio: 3.0, multiplier: 2.0 },
    ],
  },
} as const;

export const COMMISSION = {
  driverPercentage: 80,
  platformPercentage: 20,
} as const;

export const MATCHING = {
  maximumSearchRadiusKm: 10,
  expandRadius: true,
  radiusIncrementKm: 2,
  requestTimeoutSeconds: 20,
} as const;

export const OTP_CONFIG = {
  length: 6,
  expirySeconds: 300,
  maxAttempts: 5,
} as const;

export const RIDE_PIN_LENGTH = 4;

export const REFERRALS = {
  passengerReward: 500,
  driverReward: 5000,
} as const;

export const WALLET_LIMITS = {
  passengerWithdrawalAllowed: false,
  driverMinimumWithdrawal: 1000,
} as const;

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  passenger: [
    'register', 'login', 'manage_profile', 'book_ride', 'schedule_ride', 'cancel_ride',
    'track_driver', 'make_payment', 'use_wallet', 'rate_driver', 'tip_driver',
    'contact_driver', 'share_trip', 'emergency_sos', 'create_support_ticket', 'view_ride_history',
  ],
  driver: [
    'register', 'submit_kyc', 'register_vehicle', 'go_online', 'go_offline',
    'receive_ride_requests', 'accept_ride', 'reject_ride', 'navigate_to_passenger',
    'start_ride', 'complete_ride', 'view_earnings', 'request_withdrawal', 'view_wallet',
    'contact_passenger', 'report_passenger', 'view_ratings',
  ],
  admin: [
    'manage_users', 'manage_drivers', 'approve_kyc', 'manage_vehicles', 'manage_rides',
    'manage_payments', 'manage_wallets', 'manage_pricing', 'manage_promotions',
    'manage_cities', 'manage_vehicle_categories', 'manage_support', 'manage_safety',
    'view_analytics', 'view_live_map', 'manage_admins', 'view_audit_logs',
  ],
  super_admin: ['*'],
};

export function calculateFare(options: {
  category: VehicleCategory;
  distanceKm: number;
  durationMinutes: number;
  surgeMultiplier?: number;
  applyBookingFee?: boolean;
}): { fare: number; breakdown: Record<string, number> } {
  const surge = options.surgeMultiplier ?? 1;
  const base = options.category.baseFare;
  const distanceFare = options.distanceKm * options.category.perKm;
  const timeFare = options.durationMinutes * options.category.perMinute;
  const bookingFee = options.applyBookingFee ? PRICING.bookingFee : 0;
  let total = (base + distanceFare + timeFare + bookingFee) * surge;
  if (total < options.category.minimumFare) total = options.category.minimumFare;
  return {
    fare: Math.round(total),
    breakdown: {
      base_fare: base,
      distance_fare: Math.round(distanceFare * surge),
      time_fare: Math.round(timeFare * surge),
      booking_fee: bookingFee ? Math.round(bookingFee * surge) : 0,
      surge_multiplier: surge,
      minimum_fare_applied: total <= options.category.minimumFare ? 1 : 0,
    },
  };
}

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
