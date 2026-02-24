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
import { CompanyId } from '../common/decorators/company-id.decorator';
import { ReviewType } from '@prisma/client';

@Controller('questions')
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
   * Create a new question
   */
  @Post()
  async create(
    @CompanyId() companyId: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.questionsService.create(companyId, dto);
  }

  /**
   * Update a question
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.questionsService.update(id, companyId, dto);
  }

  /**
   * Delete a question
   */
  @Delete(':id')
  async delete(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.questionsService.delete(id, companyId);
  }

  /**
   * Reorder questions within a review type
   */
  @Post('reorder')
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
   * Duplicate a question
   */
  @Post(':id/duplicate')
  async duplicate(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.questionsService.duplicate(id, companyId);
  }
}
