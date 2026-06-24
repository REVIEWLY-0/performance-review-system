import { Controller, Get, Put, Body, Query } from '@nestjs/common';
import {
  DepartmentQuantScoresService,
  UpsertDepartmentQuantScoreDto,
} from './department-quant-scores.service';
import { CompanyId } from '../common/decorators/company-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('department-quant-scores')
export class DepartmentQuantScoresController {
  constructor(private readonly service: DepartmentQuantScoresService) {}

  /** GET /department-quant-scores?cycleId=X
   *  Returns all departments with their current quant score (or null) for the cycle. */
  @Get()
  findByCycle(
    @Query('cycleId') cycleId: string,
    @CompanyId() companyId: string,
  ) {
    return this.service.findByCycle(cycleId, companyId);
  }

  /** PUT /department-quant-scores
   *  Upsert a score for one department in a cycle. */
  @Put()
  upsert(
    @Body() dto: UpsertDepartmentQuantScoreDto,
    @CompanyId() companyId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.service.upsert(dto, companyId, user.id);
  }
}
