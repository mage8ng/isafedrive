import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rating } from './rating.entity';
import { RidesService } from '../rides/rides.service';
import type { User } from '../users/user.entity';

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(Rating)
    private ratingsRepository: Repository<Rating>,
    private ridesService: RidesService,
  ) {}

  async rateRide(user: User, rideId: string, dto: { rating: number; comment?: string }) {
    const ride = await this.ridesService.findById(rideId);
    if (ride.status !== 'completed') {
      throw new BadRequestException('Can only rate completed rides');
    }
    const toUser = user.id === ride.passenger.id ? ride.driver : ride.passenger;
    if (!toUser) throw new BadRequestException('No counterparty to rate');
    const rating = this.ratingsRepository.create({
      ride: { id: ride.id } as never,
      fromUser: { id: user.id } as never,
      toUser,
      rating: dto.rating,
      comment: dto.comment ?? null,
    });
    return this.ratingsRepository.save(rating);
  }

  forUser(userId: string): Promise<Rating[]> {
    return this.ratingsRepository.find({
      where: [{ toUser: { id: userId } }],
      order: { createdAt: 'DESC' },
    });
  }
}
