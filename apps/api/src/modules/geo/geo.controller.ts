import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GeoService } from './geo.service';
import { City } from './city.entity';
import { Zone } from './zone.entity';

@Controller()
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class GeoController {
  constructor(private geoService: GeoService) {}

  @Get('cities')
  cities() {
    return this.geoService.listCities();
  }

  @Post('admin/cities')
  @Roles('admin')
  createCity(@Body() body: Partial<City>) {
    return this.geoService.createCity(body);
  }

  @Get('admin/zones')
  @Roles('admin')
  zones(@Query('cityId') cityId?: string) {
    return this.geoService.listZones(cityId);
  }

  @Post('admin/zones')
  @Roles('admin')
  createZone(@Body() body: Partial<Zone>) {
    return this.geoService.createZone(body);
  }

  @Put('admin/zones/:id')
  @Roles('admin')
  updateZone(@Param('id') id: string, @Body() body: Partial<Zone>) {
    return this.geoService.updateZone(id, body);
  }
}
