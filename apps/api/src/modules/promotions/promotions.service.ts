import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Promotion } from './promotion.entity';

@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(Promotion)
    private promotionsRepository: Repository<Promotion>,
  ) {}

  async validate(code: string, fare: number) {
    const promo = await this.promotionsRepository.findOne({ where: { code } });
    if (!promo || promo.status !== 'active') {
      throw new BadRequestException('Invalid promo code');
    }
    if (promo.expiresAt && promo.expiresAt < new Date()) {
      throw new BadRequestException('Promo code expired');
    }
    if (promo.usedCount >= promo.usageLimit) {
      throw new BadRequestException('Promo code usage limit reached');
    }
    if (fare < Number(promo.minimumRideAmount)) {
      throw new BadRequestException('Fare below minimum for promo');
    }
    let discount = promo.type === 'percentage' ? (fare * Number(promo.value)) / 100 : Number(promo.value);
    discount = Math.min(discount, Number(promo.maximumDiscount));
    return { promo, discount: Math.round(discount) };
  }

  async apply(code: string) {
    const result = await this.promotionsRepository.increment(
      { code },
      'usedCount',
      1,
    );
    return result.affected === 1;
  }

  list(): Promise<Promotion[]> {
    return this.promotionsRepository.find();
  }

  create(data: Partial<Promotion>): Promise<Promotion> {
    const promo = this.promotionsRepository.create(data);
    return this.promotionsRepository.save(promo);
  }

  async disable(id: string) {
    await this.promotionsRepository.update(id, { status: 'disabled' });
    const promo = await this.promotionsRepository.findOne({ where: { id } });
    if (!promo) throw new NotFoundException('Promotion not found');
    return promo;
  }
}
