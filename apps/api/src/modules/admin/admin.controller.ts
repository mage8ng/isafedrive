import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Post,
  Put,
  Query,
  Header,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import type { User } from '../users/user.entity';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.adminService.dashboard();
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.adminService.globalSearch(q ?? '');
  }

  @Get('customers')
  customers() {
    return this.adminService.listCustomers();
  }

  @Get('customers/:id')
  customerDetail(@Param('id') id: string) {
    return this.adminService.customerDetail(id);
  }

  @Put('customers/:id/status')
  setCustomerStatus(
    @Param('id') id: string,
    @Body() body: { status: 'active' | 'suspended' },
    @CurrentUser() admin: User,
    @Ip() ip: string,
  ) {
    return this.adminService.setCustomerStatus(id, body.status, admin, ip);
  }

  @Delete('customers/:id')
  deleteCustomer(@Param('id') id: string, @CurrentUser() admin: User, @Ip() ip: string) {
    return this.adminService.deleteUserCascade(id, admin, ip);
  }

  @Delete('drivers/:id')
  deleteDriver(
    @Param('id') id: string,
    @CurrentUser() admin: User,
    @Ip() ip: string,
  ) {
    return this.adminService.deleteDriverAccount(id, admin, ip);
  }

  @Get('drivers')
  drivers() {
    return this.adminService.listDrivers();
  }

  @Get('drivers/:id')
  driverDetail(@Param('id') id: string) {
    return this.adminService.driverDetail(id);
  }

  @Put('drivers/:id/status')
  setDriverStatus(
    @Param('id') id: string,
    @Body() body: { action: 'suspend' | 'reactivate' },
    @CurrentUser() admin: User,
    @Ip() ip: string,
  ) {
    return this.adminService.setDriverStatus(id, body.action, admin, ip);
  }

  @Get('kyc')
  pendingKyc() {
    return this.adminService.pendingKyc();
  }

  @Put('kyc/:driverId')
  reviewKyc(
    @Param('driverId') driverId: string,
    @Body() body: { decision: 'approved' | 'rejected' },
    @CurrentUser() admin: User,
    @Ip() ip: string,
  ) {
    return this.adminService.reviewKyc(driverId, body.decision, admin, ip);
  }

  @Get('vehicles')
  vehicles() {
    return this.adminService.listVehicles();
  }

  @Put('vehicles/:id/approve')
  approveVehicle(
    @Param('id') id: string,
    @CurrentUser() admin: User,
    @Ip() ip: string,
  ) {
    return this.adminService.approveVehicle(id, admin, ip);
  }

  @Get('rides')
  rides(@Query('status') status?: string) {
    return this.adminService.listRides(status);
  }

  @Put('rides/:id/cancel')
  cancelRide(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() admin: User,
    @Ip() ip: string,
  ) {
    return this.adminService.adminCancelRide(id, body.reason ?? 'Cancelled by admin', admin, ip);
  }

  @Get('payments')
  payments() {
    return this.adminService.listPayments();
  }

  @Post('payments')
  createPayment(
    @Body()
    body: {
      phone?: string;
      userId?: string;
      rideId?: string;
      amount: number;
      provider: string;
      status: string;
      note?: string;
    },
    @CurrentUser() admin: User,
    @Ip() ip: string,
  ) {
    return this.adminService.createManualPayment(body, admin, ip);
  }

  @Get('wallets')
  wallets() {
    return this.adminService.listWallets();
  }

  @Get('transactions')
  transactions() {
    return this.adminService.listTransactions();
  }

  @Post('wallets/adjust')
  adjustWallet(
    @Body() body: { userId: string; amount: number; reason: string },
    @CurrentUser() admin: User,
    @Ip() ip: string,
  ) {
    return this.adminService.adjustWallet(body.userId, body.amount, body.reason, admin, ip);
  }

  @Get('withdrawals')
  withdrawals() {
    return this.adminService.listWithdrawals();
  }

  @Post('withdrawals')
  createWithdrawal(
    @Body()
    body: {
      phone?: string;
      userId?: string;
      amount: number;
      bankName: string;
      accountNumber: string;
      accountName: string;
    },
    @CurrentUser() admin: User,
    @Ip() ip: string,
  ) {
    return this.adminService.createWithdrawal(body, admin, ip);
  }

  @Put('withdrawals/:id')
  processWithdrawal(
    @Param('id') id: string,
    @Body() body: { status: 'paid' | 'rejected' },
    @CurrentUser() admin: User,
    @Ip() ip: string,
  ) {
    return this.adminService.processWithdrawal(id, body.status, admin, ip);
  }

  @Get('promotions')
  promotions() {
    return this.adminService.listPromotions();
  }

  @Post('promotions')
  createPromotion(
    @Body()
    body: {
      code: string;
      type: string;
      value: number;
      minimumRideAmount?: number;
      maximumDiscount?: number;
      usageLimit?: number;
      expiresAt?: string;
    },
    @CurrentUser() admin: User,
    @Ip() ip: string,
  ) {
    return this.adminService.createPromotion(
      {
        code: body.code.toUpperCase(),
        type: body.type as never,
        value: body.value,
        minimumRideAmount: body.minimumRideAmount ?? 0,
        maximumDiscount: body.maximumDiscount ?? 5000,
        usageLimit: body.usageLimit ?? 100,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
      admin,
      ip,
    );
  }

  @Put('promotions/:id/disable')
  disablePromotion(@Param('id') id: string, @CurrentUser() admin: User, @Ip() ip: string) {
    return this.adminService.disablePromotion(id, admin, ip);
  }

  @Get('ratings')
  ratings() {
    return this.adminService.listRatings();
  }

  @Get('safety')
  incidents() {
    return this.adminService.listIncidents();
  }

  @Put('safety/:id/resolve')
  resolveIncident(@Param('id') id: string, @CurrentUser() admin: User, @Ip() ip: string) {
    return this.adminService.resolveIncident(id, admin, ip);
  }

  @Get('support')
  tickets() {
    return this.adminService.listTickets();
  }

  @Put('support/:id/status')
  updateTicket(
    @Param('id') id: string,
    @Body() body: { status: string },
    @CurrentUser() admin: User,
    @Ip() ip: string,
  ) {
    return this.adminService.updateTicketStatus(id, body.status, admin, ip);
  }

  @Get('live/drivers')
  liveDrivers() {
    return this.adminService.onlineDrivers();
  }

  @Get('live/overview')
  liveOverview() {
    return this.adminService.liveOverview();
  }

  @Get('pricing')
  pricing() {
    return this.adminService.pricingConfig();
  }

  @Post('notifications/broadcast')
  broadcast(
    @Body() body: { role?: string | null; title: string; message: string },
    @CurrentUser() admin: User,
    @Ip() ip: string,
  ) {
    return this.adminService.broadcast(body.role ?? null, body.title, body.message, admin, ip);
  }

  @Get('admins')
  @Roles('super_admin')
  admins() {
    return this.adminService.listAdmins();
  }

  @Post('admins')
  @Roles('super_admin')
  createAdmin(
    @Body() body: { fullName: string; phone: string },
    @CurrentUser() admin: User,
    @Ip() ip: string,
  ) {
    return this.adminService.createAdmin(body.fullName, body.phone, admin, ip);
  }

  @Get('audit-logs')
  auditLogs() {
    return this.adminService.auditLogs();
  }

  @Post('2fa/setup')
  setup2fa(@CurrentUser() admin: User) {
    return this.adminService.setup2fa(admin.id);
  }

  @Post('2fa/enable')
  enable2fa(@CurrentUser() admin: User, @Body() body: { token: string }) {
    return this.adminService.enable2fa(admin.id, body.token);
  }

  @Post('2fa/disable')
  disable2fa(@CurrentUser() admin: User, @Body() body: { token: string }) {
    return this.adminService.disable2fa(admin.id, body.token);
  }

  @Get('reports/trips.csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="isafedrive-trips.csv"')
  tripsCsv() {
    return this.adminService.tripsCsv();
  }

  @Get('reports/payments.csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="isafedrive-payments.csv"')
  paymentsCsv() {
    return this.adminService.paymentsCsv();
  }
}
