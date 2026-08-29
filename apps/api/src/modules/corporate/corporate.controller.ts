import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CorporateService } from './corporate.service';
import type { User } from '../users/user.entity';

class CreateAccountDto {
  @IsString() name: string;
  @IsString() adminPhone: string;
  @IsOptional() costCenters?: string[];
}

class AddEmployeeDto {
  @IsString() phone: string;
  @IsOptional() @IsNumber() perRideLimit?: number;
  @IsOptional() @IsNumber() monthlyLimit?: number;
  @IsOptional() @IsString() department?: string;
}

class TopUpDto {
  @IsNumber() amount: number;
}

@Controller()
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CorporateController {
  constructor(private corporateService: CorporateService) {}

  @Get('corporate/my')
  myAccounts(@CurrentUser() user: User) {
    return this.corporateService.accountsForUser(user.id);
  }

  @Post('admin/corporate')
  @Roles('admin')
  create(@Body() dto: CreateAccountDto) {
    return this.corporateService.createAccount(dto.name, dto.adminPhone);
  }

  @Get('admin/corporate')
  @Roles('admin')
  list() {
    return this.corporateService.listAccounts();
  }

  @Get('admin/corporate/:id')
  @Roles('admin')
  detail(@Param('id') id: string) {
    return this.corporateService.accountDetail(id);
  }

  @Post('admin/corporate/:id/employees')
  @Roles('admin')
  addEmployee(
    @Param('id') id: string,
    @Body() dto: AddEmployeeDto,
  ) {
    return this.corporateService.addEmployee(
      id,
      dto.phone,
      dto.perRideLimit,
      dto.monthlyLimit,
      dto.department,
    );
  }

  @Post('admin/corporate/:id/topup')
  @Roles('admin')
  topUp(@Param('id') id: string, @Body() dto: TopUpDto) {
    return this.corporateService.topUp(id, dto.amount);
  }

  @Get('admin/corporate/:id/invoice')
  @Roles('admin')
  async invoice(
    @Param('id') id: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.corporateService.monthlyInvoice(
      id,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );
  }
}
