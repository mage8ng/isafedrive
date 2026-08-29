import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportTicket } from './support-ticket.entity';
import type { User } from '../users/user.entity';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket)
    private ticketsRepository: Repository<SupportTicket>,
  ) {}

  async create(user: User, data: Partial<SupportTicket>) {
    const ticket = this.ticketsRepository.create({ ...data, user });
    return this.ticketsRepository.save(ticket);
  }

  mine(userId: string) {
    return this.ticketsRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  list() {
    return this.ticketsRepository.find({ order: { createdAt: 'DESC' } });
  }

  async updateStatus(id: string, status: string, adminId?: string) {
    await this.ticketsRepository.update(id, {
      status: status as never,
      resolvedAt: status === 'resolved' ? new Date() : null,
      ...(adminId ? { assignedAdmin: { id: adminId } as never } : {}),
    });
    const ticket = await this.ticketsRepository.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }
}
