import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { User } from '../users/user.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async send(userId: string, title: string, message: string, type = 'general') {
    const notification = await this.notificationsRepository.save(
      this.notificationsRepository.create({
        user: { id: userId } as never,
        title,
        message,
        type,
      }),
    );
    this.logger.log(`[FCM] ${type} -> ${userId}: ${title}`);
    return notification;
  }

  forUser(userId: string): Promise<Notification[]> {
    return this.notificationsRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async broadcast(role: string | null, title: string, message: string, type = 'broadcast') {
    const qb = this.usersRepository
      .createQueryBuilder('user')
      .select('user.id', 'userId');
    if (role) {
      qb.where('user.role = :role', { role });
    }
    const recipients = await qb.getRawMany<{ userId: string }>();
    if (recipients.length === 0) return { sent: 0 };
    await this.notificationsRepository.save(
      recipients.map((r) =>
        this.notificationsRepository.create({
          user: { id: r.userId } as never,
          title,
          message,
          type,
        }),
      ),
    );
    this.logger.log(`[FCM broadcast] ${type} -> ${recipients.length} users: ${title}`);
    return { sent: recipients.length };
  }
}
