import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import {
  ReviewTypeConfigsService,
  CreateReviewTypeConfigDto,
  UpdateReviewTypeConfigDto,
} from './review-type-configs.service';
import { CompanyId } from '../common/decorators/company-id.decorator';

@Controller('review-type-configs')
export class ReviewTypeConfigsController {
  constructor(private readonly service: ReviewTypeConfigsService) {}

  /**
   * List all review type configs for the current company (built-ins + custom)
   */
  @Get()
  async findAll(@CompanyId() companyId: string) {
    return this.service.findAll(companyId);
  }

  /**
   * Create a custom review type
   */
  @Post()
  async create(
    @CompanyId() companyId: string,
    @Body() dto: CreateReviewTypeConfigDto,
  ) {
    return this.service.create(companyId, dto);
  }

  /**
   * Update a review type config (toggle isRequired, rename custom types)
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Body() dto: UpdateReviewTypeConfigDto,
  ) {
    return this.service.update(id, companyId, dto);
  }

  /**
   * Delete (soft) a custom review type
   */
  @Delete(':id')
  async delete(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.service.delete(id, companyId);
  }
}
