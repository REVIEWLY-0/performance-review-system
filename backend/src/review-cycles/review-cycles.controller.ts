import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReviewCyclesService } from './review-cycles.service';
import { CompanyId } from '../common/decorators/company-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ReviewCycleStatus } from '@prisma/client';
import {
  CreateReviewCycleDto,
  UpdateReviewCycleDto,
  UpdateConfigsBodyDto,
} from './review-cycles.service';

@Controller('review-cycles')
export class ReviewCyclesController {
  constructor(private readonly reviewCyclesService: ReviewCyclesService) {}

  /**
   * GET /review-cycles?status=DRAFT&page=1&limit=50
   * List all review cycles for the authenticated user's company
   * Optionally filter by status
   */
  @Get()
  async findAll(
    @CompanyId() companyId: string,
    @Query('status') status?: ReviewCycleStatus,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.reviewCyclesService.findAll(companyId, status, +page, +limit);
  }

  /**
   * GET /review-cycles/:id
   * Get a single review cycle with its workflow configs
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.reviewCyclesService.findOne(id, companyId);
  }

  /**
   * POST /review-cycles
   * Create a new review cycle with workflow configs
   * Admin only
   */
  @Post()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async create(
    @CompanyId() companyId: string,
    @Body() dto: CreateReviewCycleDto,
  ) {
    return this.reviewCyclesService.create(companyId, dto);
  }

  /**
   * PUT /review-cycles/:id
   * Update review cycle basic info (name, dates)
   * Admin only, DRAFT cycles only
   */
  @Put(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async update(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Body() dto: UpdateReviewCycleDto,
  ) {
    return this.reviewCyclesService.update(id, companyId, dto);
  }

  /**
   * PUT /review-cycles/:id/configs
   * Update workflow step configurations
   * Admin only, DRAFT cycles only
   */
  @Put(':id/configs')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async updateConfigs(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Body() body: UpdateConfigsBodyDto,
  ) {
    return this.reviewCyclesService.updateConfigs(
      id,
      companyId,
      body.configs,
    );
  }

  /**
   * POST /review-cycles/:id/activate
   * Activate a review cycle (DRAFT -> ACTIVE)
   * Admin only
   */
  @Post(':id/activate')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async activate(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.reviewCyclesService.activate(id, companyId);
  }

  /**
   * POST /review-cycles/:id/complete
   * Complete a review cycle (ACTIVE -> COMPLETED)
   * Admin only
   */
  @Post(':id/complete')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async complete(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.reviewCyclesService.complete(id, companyId);
  }

  /**
   * DELETE /review-cycles/:id
   * Delete a review cycle
   * Admin only, DRAFT cycles only
   */
  @Delete(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async delete(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.reviewCyclesService.delete(id, companyId);
  }
}
