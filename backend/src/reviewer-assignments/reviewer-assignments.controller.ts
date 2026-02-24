import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReviewerAssignmentsService } from './reviewer-assignments.service';
import { CompanyId } from '../common/decorators/company-id.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  BulkCreateAssignmentsDto,
  BulkUpsertBodyDto,
  ImportAssignmentsBodyDto,
} from './reviewer-assignments.service';

@Controller('reviewer-assignments')
export class ReviewerAssignmentsController {
  constructor(
    private readonly reviewerAssignmentsService: ReviewerAssignmentsService,
  ) {}

  /**
   * GET /reviewer-assignments?reviewCycleId=xxx
   * Get all assignments for a review cycle, grouped by employee
   */
  @Get()
  async findByCycle(
    @Query('reviewCycleId') reviewCycleId: string,
    @CompanyId() companyId: string,
  ) {
    return this.reviewerAssignmentsService.findByCycle(
      reviewCycleId,
      companyId,
    );
  }

  /**
   * POST /reviewer-assignments
   * Create/update assignments for a single employee
   * Replaces all existing assignments for that employee
   */
  @Post()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async upsertForEmployee(
    @Body() dto: BulkCreateAssignmentsDto,
    @CompanyId() companyId: string,
  ) {
    return this.reviewerAssignmentsService.upsertForEmployee(
      dto,
      companyId,
    );
  }

  /**
   * POST /reviewer-assignments/bulk
   * Create/update assignments for multiple employees at once
   */
  @Post('bulk')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async bulkUpsert(
    @Body() body: BulkUpsertBodyDto,
    @CompanyId() companyId: string,
  ) {
    return this.reviewerAssignmentsService.bulkUpsert(
      body.assignments,
      companyId,
    );
  }

  /**
   * POST /reviewer-assignments/import
   * Import assignments from Excel/CSV
   * Admin only
   */
  @Post('import')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async importAssignments(
    @Body() body: ImportAssignmentsBodyDto,
    @CompanyId() companyId: string,
  ) {
    return this.reviewerAssignmentsService.importAssignments(
      body.reviewCycleId,
      body.assignments,
      companyId,
    );
  }

  /**
   * DELETE /reviewer-assignments/:id
   * Delete a specific assignment
   */
  @Delete(':id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async remove(
    @Param('id') id: string,
    @CompanyId() companyId: string,
  ) {
    return this.reviewerAssignmentsService.remove(id, companyId);
  }

  /**
   * DELETE /reviewer-assignments/employee/:employeeId
   * Delete all assignments for an employee in a cycle
   */
  @Delete('employee/:employeeId')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async removeAllForEmployee(
    @Param('employeeId') employeeId: string,
    @Query('reviewCycleId') reviewCycleId: string,
    @CompanyId() companyId: string,
  ) {
    return this.reviewerAssignmentsService.removeAllForEmployee(
      employeeId,
      reviewCycleId,
      companyId,
    );
  }
}
