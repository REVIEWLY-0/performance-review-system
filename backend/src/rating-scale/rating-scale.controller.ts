import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { RatingScaleService, UpsertRatingScaleDto } from './rating-scale.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CompanyId } from '../common/decorators/company-id.decorator';

@Controller('rating-scale')
@UseGuards(AuthGuard)
export class RatingScaleController {
  constructor(private readonly ratingScaleService: RatingScaleService) {}

  /**
   * GET /rating-scale
   * Get the company's rating scale config (all authenticated users — needed during reviews)
   */
  @Get()
  async findByCompany(@CompanyId() companyId: string) {
    return this.ratingScaleService.findByCompany(companyId);
  }

  /**
   * PUT /rating-scale
   * Create or update the company's rating scale — ADMIN only
   */
  @Put()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async upsert(
    @CompanyId() companyId: string,
    @Body() dto: UpsertRatingScaleDto,
  ) {
    return this.ratingScaleService.upsert(companyId, dto);
  }
}
