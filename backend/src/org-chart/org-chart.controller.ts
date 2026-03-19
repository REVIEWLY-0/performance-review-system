import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { OrgChartService, CreateOrgChartNodeDto, UpdateOrgChartNodeDto } from './org-chart.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CompanyId } from '../common/decorators/company-id.decorator';

@Controller('org-chart')
@UseGuards(AuthGuard)
export class OrgChartController {
  constructor(private readonly orgChartService: OrgChartService) {}

  /**
   * GET /org-chart — all authenticated users can view
   */
  @Get()
  async getAll(@CompanyId() companyId: string) {
    return this.orgChartService.getAll(companyId);
  }

  /**
   * POST /org-chart — admin only
   */
  @Post()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async create(
    @Body() dto: CreateOrgChartNodeDto,
    @CompanyId() companyId: string,
  ) {
    return this.orgChartService.create(companyId, dto);
  }

  /**
   * PATCH /org-chart/:id — admin only
   */
  @Patch(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrgChartNodeDto,
    @CompanyId() companyId: string,
  ) {
    return this.orgChartService.update(id, companyId, dto);
  }

  /**
   * DELETE /org-chart/:id — admin only
   */
  @Delete(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async delete(
    @Param('id') id: string,
    @CompanyId() companyId: string,
  ) {
    return this.orgChartService.delete(id, companyId);
  }
}
