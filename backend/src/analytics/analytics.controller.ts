import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CompanyId } from '../common/decorators/company-id.decorator';

@Controller('analytics')
@UseGuards(AuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /analytics/admin/:cycleId
   * Get company-wide analytics for admins — ADMIN only
   */
  @Get('admin/:cycleId')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async getAdminAnalytics(
    @Param('cycleId') cycleId: string,
    @CurrentUser() user: any,
    @CompanyId() companyId: string,
  ) {
    return this.analyticsService.getAdminAnalytics(cycleId, companyId);
  }

  /**
   * GET /analytics/manager/:cycleId
   * Get team analytics for managers — ADMIN or MANAGER only
   */
  @Get('manager/:cycleId')
  @Roles('ADMIN', 'MANAGER')
  @UseGuards(RolesGuard)
  async getManagerAnalytics(
    @Param('cycleId') cycleId: string,
    @CurrentUser() user: any,
    @CompanyId() companyId: string,
  ) {
    return this.analyticsService.getManagerAnalytics(
      user.id,
      cycleId,
      companyId,
    );
  }

  /**
   * GET /analytics/employee/:cycleId
   * Get personal analytics for employees
   */
  @Get('employee/:cycleId')
  async getEmployeeAnalytics(
    @Param('cycleId') cycleId: string,
    @CurrentUser() user: any,
    @CompanyId() companyId: string,
  ) {
    return this.analyticsService.getEmployeeAnalytics(
      user.id,
      cycleId,
      companyId,
    );
  }
}
