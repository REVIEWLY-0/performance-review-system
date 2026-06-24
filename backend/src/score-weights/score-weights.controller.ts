import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ScoreWeightsService } from './score-weights.service';
import { UpdateScoreWeightsDto } from './score-weights.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CompanyId } from '../common/decorators/company-id.decorator';

@UseGuards(AuthGuard, RolesGuard)
@Controller('score-weights')
export class ScoreWeightsController {
  constructor(private service: ScoreWeightsService) {}

  @Roles('ADMIN')
  @Get()
  get(@CompanyId() companyId: string) {
    return this.service.getOrCreate(companyId);
  }

  @Roles('ADMIN')
  @Put()
  update(@CompanyId() companyId: string, @Body() dto: UpdateScoreWeightsDto) {
    return this.service.update(companyId, dto);
  }
}
