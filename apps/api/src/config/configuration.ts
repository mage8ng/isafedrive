export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/isafedrive',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY ?? '',
  flutterwaveSecretKey: process.env.FLUTTERWAVE_SECRET_KEY ?? '',
});
