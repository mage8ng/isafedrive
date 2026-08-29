# iSafeDrive Platform Monorepo

Safe Rides. Trusted Drivers. Better Journeys.

Ride-hailing platform for the Nigerian market: NestJS REST/WebSocket API, Flutter passenger & driver apps, Next.js admin dashboard.

## Structure

```
apps/
  api/                NestJS API (/api/v1) - auth, rides, drivers, payments, wallet, admin, realtime
  passenger-app/      Flutter passenger app (booking, tracking, history)
  driver-app/         Flutter driver app (KYC, online/offline, earnings)
  admin-dashboard/    Next.js admin dashboard (overview, KYC queue, drivers, rides)
packages/
  shared/             Shared constants: vehicle categories, fare formula, commission, roles
```

## Prerequisites

- Node.js >= 20, npm >= 10
- PostgreSQL 14+ (default `postgresql://postgres:postgres@localhost:5432/isafedrive`)
- Flutter >= 3.4 for mobile apps (`flutter create .` inside each app folder to generate android/ios platform folders)

## Quick start

```bash
# 1. Configure environment
copy .env.example .env        # Windows (or `cp` on unix), then edit values

# 2. Install everything (workspaces) - builds packages/shared automatically
npm install

# 3. Start the API (http://localhost:3000/api/v1)
npm run dev:api

# 4. Start the admin dashboard (http://localhost:3100)
npm run dev:admin
```

The database schema is auto-synchronized in non-production mode (`synchronize: true`). Create the database first:

```sql
CREATE DATABASE isafedrive;
```

### OTP / login flow

OTP codes are printed to the API console (`[SMS] OTP for ...`) until an SMS provider is wired in.
Create an admin by registering a user then updating its role directly:

```sql
UPDATE users SET role = 'admin' WHERE phone = '+234...';
```

Then sign in on the dashboard at http://localhost:3100.

## API surface (base `/api/v1`)

| Group | Endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/send-otp`, `/auth/verify-otp`, `/auth/refresh`, `/auth/logout` |
| Passengers | `GET/PUT /passengers/profile`, `GET /passengers/rides`, `GET /passengers/wallet`, `POST /passengers/wallet/deposit` |
| Drivers | `GET /drivers/profile`, `POST /drivers/kyc`, `POST /drivers/vehicles`, `/drivers/go-online`, `/drivers/go-offline`, `PUT /drivers/location`, `GET /drivers/earnings`, `GET /drivers/wallet`, `POST /drivers/withdraw` |
| Rides | `POST /rides/estimate`, `POST /rides`, `GET /rides/:id`, `POST /rides/:id/{accept,reject,arrived,start,complete,cancel}` |
| Payments | `POST /payments/initialize`, `POST /payments/webhook/:provider` (signature-verified) |
| Ratings | `POST /rides/:id/rate`, `GET /ratings` |
| Safety | `POST /safety/sos`, `POST /safety/incidents`, `GET /safety/incidents` |
| Support | `POST /support/tickets`, `GET /support/tickets` |
| Admin | `GET /admin/dashboard`, `/admin/drivers`, `/admin/kyc`, `PUT /admin/kyc/:driverId`, `/admin/vehicles`, `/admin/rides`, `/admin/payments`, `/admin/withdrawals`, `PUT /admin/withdrawals/:id` |

WebSocket namespace `/realtime`: rooms `user:{id}`, `ride:{id}`, `admins`; events `driver_location`, `ride_request`, `driver_assigned`, `ride_status`. Auth with `socket.handshake.auth.token`.

## Ride engine notes

- Matching: online + KYC-approved drivers of the requested category within radius, scored by rating, acceptance rate and distance; radius expands 2km steps to 10km max (see `packages/shared/src/index.ts`).
- Fare: `(base + km*per_km + min*per_minute + booking_fee) * surge`, floored at minimum fare.
- Ride PIN: 4 digits generated per ride, verified by the driver via `POST /rides/:id/start`.
- Commission: platform 20% / driver 80% default.
- Surge: ratio-based rules table (1.5x demand -> 1.2 multiplier etc.), capped at 3.0.

## Production hardening checklist

- Swap bcryptjs for argon2 password hashing (`@node-rs/argon2`)
- Replace in-memory OTP store with Redis-backed store
- Wire real FCM credentials into NotificationsService
- Disable TypeORM `synchronize` and use migrations
- Add rate limiting (helmet + throttler), request logging, and audit logs
- Restrict CORS origins; set strong JWT secrets

## Mobile apps

```bash
cd apps/passenger-app   # or apps/driver-app
flutter create . --platforms=android,ios   # generate platform folders
flutter pub get
flutter run
```

Android emulator reaches the API at `http://10.0.2.2:3000` (the default base URL). Point both apps at a deployed URL by overriding `api_base_url` in SharedPreferences or editing `core/theme.dart > AppConstants.defaultApiBaseUrl`.
