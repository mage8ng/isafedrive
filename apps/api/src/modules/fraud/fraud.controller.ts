import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { FraudService } from './fraud.service';

@Controller()
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class FraudController {
  constructor(private fraudService: FraudService) {}

  @Get('admin/fraud/alerts')
  @Roles('admin')
  alerts() {
    return this.fraudService.listAlerts();
  }

  @Post('admin/fraud/scan')
  @Roles('admin')
  scanAll() {
    return this.fraudService.scanAll();
  }

  @Post('admin/fraud/scan/:userId')
  @Roles('admin')
  scanUser(@Param('userId') userId: string) {
    return this.fraudService.scanUser(userId);
  }

  @Post('admin/fraud/alerts/:id/resolve')
  @Roles('admin')
  resolve(@Param('id') id: string) {
    return this.fraudService.resolveAlert(id);
  }
}
