import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './app.module';

function passengerWebDir(): string {
  const candidates = [
    join(process.cwd(), '..', 'passenger-web', 'public'),
    join(process.cwd(), 'apps', 'passenger-web', 'public'),
    join(__dirname, '..', '..', 'passenger-web', 'public'),
  ];
  return candidates.find((p) => existsSync(p)) ?? candidates[0];
}

function driverWebDir(): string {
  const candidates = [
    join(process.cwd(), '..', 'driver-web', 'public'),
    join(process.cwd(), 'apps', 'driver-web', 'public'),
    join(__dirname, '..', '..', 'driver-web', 'public'),
  ];
  return candidates.find((p) => existsSync(p)) ?? candidates[0];
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  app.setGlobalPrefix('api/v1');
  app.enableCors();
  app.useStaticAssets(passengerWebDir());
  app.useStaticAssets(driverWebDir(), { prefix: '/driver' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  app.getHttpAdapter().getInstance().get('/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  // Also listen on 3000 so the pax/driver proxies can reach the API on the
  // Render internal network at http://isafedrive-api:3000 (Render's PORT
  // override is unreliable, so we expose 3000 explicitly).
  if (port !== 3000) {
    app.listen(3000, '0.0.0.0');
  }
}
bootstrap();
