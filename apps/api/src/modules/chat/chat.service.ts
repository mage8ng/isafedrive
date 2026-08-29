import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from './chat-message.entity';
import { RidesService } from '../rides/rides.service';
import { RealtimeGateway } from '../../realtime/events.gateway';
import type { User } from '../users/user.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private messagesRepository: Repository<ChatMessage>,
    private ridesService: RidesService,
    private realtimeGateway: RealtimeGateway,
  ) {}

  async send(user: User, rideId: string, text: string): Promise<ChatMessage> {
    const ride = await this.ridesService.findById(rideId);
    const isPassenger = ride.passenger.id === user.id;
    const isDriver = ride.driver?.id === user.id;
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    if (!isPassenger && !isDriver && !isAdmin) {
      throw new BadRequestException('You are not a participant of this ride');
    }
    const message = await this.messagesRepository.save(
      this.messagesRepository.create({
        ride: { id: rideId } as never,
        sender: user,
        text,
      }),
    );
    this.realtimeGateway.emitToUser(ride.passenger.id, 'chat_message', {
      rideId,
      from: user.phone,
      text,
      at: message.createdAt,
    });
    if (ride.driver) {
      this.realtimeGateway.emitToUser(ride.driver.id, 'chat_message', {
        rideId,
        from: user.phone,
        text,
        at: message.createdAt,
      });
    }
    return message;
  }

  async forRide(user: User, rideId: string): Promise<ChatMessage[]> {
    const ride = await this.ridesService.findById(rideId);
    const isPassenger = ride.passenger.id === user.id;
    const isDriver = ride.driver?.id === user.id;
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    if (!isPassenger && !isDriver && !isAdmin) {
      throw new NotFoundException('Not found');
    }
    return this.messagesRepository.find({
      where: { ride: { id: rideId } },
      order: { createdAt: 'ASC' },
    });
  }
}
