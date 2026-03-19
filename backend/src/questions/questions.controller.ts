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
import { QuestionsService, CreateQuestionDto, UpdateQuestionDto } from './questions.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CompanyId } from '../common/decorators/company-id.decorator';
import { ReviewType } from '@prisma/client';

@Controller('questions')
@UseGuards(AuthGuard)
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  /**
   * Get all questions, optionally filtered by review type
   */
  @Get()
  async findAll(
    @CompanyId() companyId: string,
    @Query('reviewType') reviewType?: ReviewType,
    @Query('page') page = 1,
    @Query('limit') limit = 100,
  ) {
    return this.questionsService.findAll(companyId, reviewType, +page, +limit);
  }

  /**
   * Get questions grouped by review type
   */
  @Get('grouped')
  async findGrouped(@CompanyId() companyId: string) {
    return this.questionsService.findGroupedByType(companyId);
  }

  /**
   * Get a single question by ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.questionsService.findOne(id, companyId);
  }

  /**
   * Create a new question — ADMIN only
   */
  @Post()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async create(
    @CompanyId() companyId: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.questionsService.create(companyId, dto);
  }

  /**
   * Update a question — ADMIN only
   */
  @Put(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async update(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.questionsService.update(id, companyId, dto);
  }

  /**
   * Delete a question — ADMIN only
   */
  @Delete(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async delete(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.questionsService.delete(id, companyId);
  }

  /**
   * Reorder questions within a review type — ADMIN only
   */
  @Post('reorder')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async reorder(
    @CompanyId() companyId: string,
    @Body() body: { reviewType: ReviewType; questionIds: string[] },
  ) {
    return this.questionsService.reorder(
      companyId,
      body.reviewType,
      body.questionIds,
    );
  }

  /**
   * Duplicate a question — ADMIN only
   */
  @Post(':id/duplicate')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async duplicate(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.questionsService.duplicate(id, companyId);
  }
}
