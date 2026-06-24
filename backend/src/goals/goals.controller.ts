import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GoalsService } from './goals.service';
import { CreateGoalDto, UpdateGoalDto, UpsertQuantScoreDto } from './goals.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CompanyId } from '../common/decorators/company-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(AuthGuard, RolesGuard)
@Controller('goals')
export class GoalsController {
  constructor(private service: GoalsService) {}

  @Roles('ADMIN', 'MANAGER')
  @Get()
  list(
    @CompanyId() companyId: string,
    @Query('cycleId') cycleId: string,
    @Query('employeeId') employeeId: string,
  ) {
    return this.service.listGoals(companyId, cycleId, employeeId);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post()
  create(
    @CompanyId() companyId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateGoalDto,
  ) {
    return this.service.createGoal(companyId, user.id, dto);
  }

  @Roles('ADMIN', 'MANAGER')
  @Patch(':id')
  update(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.service.updateGoal(companyId, id, dto);
  }

  @Roles('ADMIN', 'MANAGER')
  @Delete(':id')
  remove(@CompanyId() companyId: string, @Param('id') id: string) {
    return this.service.deleteGoal(companyId, id);
  }

  @Roles('ADMIN', 'MANAGER')
  @Put('quant-score')
  upsertQuantScore(
    @CompanyId() companyId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpsertQuantScoreDto,
  ) {
    return this.service.upsertQuantScore(companyId, user.id, dto);
  }

  @Roles('ADMIN', 'MANAGER')
  @Get('quant-score')
  getQuantScore(
    @CompanyId() companyId: string,
    @Query('cycleId') cycleId: string,
    @Query('employeeId') employeeId: string,
  ) {
    return this.service.getQuantScore(companyId, cycleId, employeeId);
  }
}
