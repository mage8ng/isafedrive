import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SafetyService } from './safety.service';
import type { User } from '../users/user.entity';

@Controller()
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SafetyController {
  constructor(private safetyService: SafetyService) {}

  @Post('safety/sos')
  sos(
    @CurrentUser() user: User,
    @Body() body: { rideId?: string; description?: string; latitude?: number; longitude?: number },
  ) {
    return this.safetyService.report({
      ride: body.rideId ? ({ id: body.rideId } as never) : undefined,
      reportedBy: user,
      type: 'sos',
      description:
        body.description ??
        `SOS triggered${body.latitude ? ` at ${body.latitude},${body.longitude}` : ''}`,
      severity: 'critical',
    });
  }

  @Post('safety/incidents')
  report(
    @CurrentUser() user: User,
    @Body() body: { rideId: string; type: string; description?: string },
  ) {
    return this.safetyService.report({
      ride: { id: body.rideId } as never,
      reportedBy: user,
      type: body.type,
      description: body.description ?? null,
    });
  }

  @Get('safety/incidents')
  @Roles('admin')
  list() {
    return this.safetyService.list();
  }
}
