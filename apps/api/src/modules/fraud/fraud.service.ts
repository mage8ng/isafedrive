import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { haversineKm } from '@isafedrive/shared';
import { FraudAlert, FraudSeverity } from './fraud-alert.entity';
import { UsersService } from '../users/users.service';
import { Ride } from '../rides/ride.entity';

@Injectable()
export class FraudService {
  constructor(
    @InjectRepository(FraudAlert)
    private alertsRepository: Repository<FraudAlert>,
    @InjectRepository(Ride)
    private ridesRepository: Repository<Ride>,
    private usersService: UsersService,
  ) {}

  private async hasOpenAlert(userId: string, rule: string) {
    const existing = await this.alertsRepository.findOne({
      where: { user: { id: userId }, rule, status: 'open' },
    });
    return Boolean(existing);
  }

  private async raise(
    userId: string,
    rule: string,
    severity: FraudSeverity,
    details: Record<string, unknown>,
  ) {
    if (await this.hasOpenAlert(userId, rule)) return;
    await this.alertsRepository.save(
      this.alertsRepository.create({ user: { id: userId } as never, rule, severity, details }),
    );
  }

  async scanUser(userId: string): Promise<{ rule: string; severity: string }[]> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const raised: { rule: string; severity: string }[] = [];
    const rides = await this.ridesRepository.find({
      where: [{ passenger: { id: userId } }],
      order: { requestedAt: 'DESC' },
      take: 100,
    });

    if (user.lastDeviceId) {
      const sharers = await this.usersService.list();
      const others = sharers.filter(
        (u) => u.id !== userId && u.lastDeviceId === user.lastDeviceId,
      );
      if (others.length > 0) {
        const rule = 'multiple_accounts_same_device';
        await this.raise(userId, rule, 'high', {
          deviceId: user.lastDeviceId,
          otherAccounts: others.map((o) => o.phone),
        });
        raised.push({ rule, severity: 'high' });
      }
    }

    if (rides.length >= 5) {
      const cancelled = rides.filter((r) => r.status === 'cancelled').length;
      const rate = cancelled / rides.length;
      if (rate > 0.6) {
        const rule = 'abnormal_cancellation_pattern';
        await this.raise(userId, rule, 'medium', {
          cancelled,
          total: rides.length,
          rate: Number((rate * 100).toFixed(1)),
        });
        raised.push({ rule, severity: 'medium' });
      }
    }

    const chronological = [...rides].reverse();
    for (let i = 1; i < chronological.length; i++) {
      const prev = chronological[i - 1];
      const curr = chronological[i];
      const minutes =
        (curr.requestedAt.getTime() - prev.requestedAt.getTime()) / 60000;
      const km = haversineKm(
        prev.pickupLatitude,
        prev.pickupLongitude,
        curr.pickupLatitude,
        curr.pickupLongitude,
      );
      if (minutes > 0 && minutes <= 90 && km / (minutes / 60) > 400) {
        const rule = 'impossible_travel';
        await this.raise(userId, rule, 'critical', {
          km: Number(km.toFixed(1)),
          minutes: Number(minutes.toFixed(1)),
          speedKmh: Number((km / (minutes / 60)).toFixed(0)),
        });
        raised.push({ rule, severity: 'critical' });
        break;
      }
    }

    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
    const recentShort = rides.filter(
      (r) =>
        r.requestedAt >= dayAgo &&
        r.status === 'completed' &&
        (r.distanceKm ?? 99) < 2.5,
    );
    if (recentShort.length >= 6) {
      const rule = 'repeated_short_trips';
      await this.raise(userId, rule, 'high', {
        count: recentShort.length,
        windowHours: 24,
      });
      raised.push({ rule, severity: 'high' });
    }

    const promoCounts = new Map<string, number>();
    for (const r of rides) {
      if (!r.promoCode) continue;
      promoCounts.set(r.promoCode, (promoCounts.get(r.promoCode) ?? 0) + 1);
    }
    for (const [code, count] of promoCounts) {
      if (count >= 15) {
        const rule = 'promo_abuse';
        await this.raise(userId, rule, 'medium', { code, used: count });
        raised.push({ rule, severity: 'medium' });
      }
    }

    return raised;
  }

  async scanAll(): Promise<{ scanned: number; alerts: number }> {
    const users = await this.usersService.list();
    let alerts = 0;
    for (const user of users) {
      const raised = await this.scanUser(user.id).catch(() => []);
      alerts += raised.length;
    }
    return { scanned: users.length, alerts };
  }

  listAlerts(): Promise<FraudAlert[]> {
    return this.alertsRepository
      .createQueryBuilder('alert')
      .leftJoinAndSelect('alert.user', 'user')
      .orderBy('alert.createdAt', 'DESC')
      .take(200)
      .getMany();
  }

  async resolveAlert(id: string) {
    await this.alertsRepository.update(id, { status: 'resolved' });
    const alert = await this.alertsRepository.findOne({ where: { id } });
    if (!alert) throw new NotFoundException('Alert not found');
    return alert;
  }

  async riskBadge(userId: string): Promise<string> {
    const alerts = await this.alertsRepository.find({
      where: { user: { id: userId }, status: In(['open', 'investigating']) },
    });
    if (alerts.some((a) => a.severity === 'critical')) return 'critical';
    if (alerts.some((a) => a.severity === 'high')) return 'high';
    if (alerts.some((a) => a.severity === 'medium')) return 'medium';
    if (alerts.length > 0) return 'low';
    return 'none';
  }
}
