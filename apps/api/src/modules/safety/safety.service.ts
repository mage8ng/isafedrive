import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SafetyIncident } from './safety-incident.entity';

@Injectable()
export class SafetyService {
  constructor(
    @InjectRepository(SafetyIncident)
    private incidentsRepository: Repository<SafetyIncident>,
  ) {}

  report(data: Partial<SafetyIncident>): Promise<SafetyIncident> {
    const incident = this.incidentsRepository.create(data);
    return this.incidentsRepository.save(incident);
  }

  list(): Promise<SafetyIncident[]> {
    return this.incidentsRepository.find({ order: { createdAt: 'DESC' } });
  }
}
