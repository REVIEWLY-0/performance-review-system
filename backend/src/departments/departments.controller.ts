import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
} from '@nestjs/common';
import {
  DepartmentsService,
  CreateDepartmentDto,
  UpdateDepartmentDto,
} from './departments.service';
import { CompanyId } from '../common/decorators/company-id.decorator';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  /** GET /departments — list active departments */
  @Get()
  findAll(@CompanyId() companyId: string) {
    return this.service.findAll(companyId);
  }

  /** GET /departments/archived — list archived departments */
  @Get('archived')
  findArchived(@CompanyId() companyId: string) {
    return this.service.findArchived(companyId);
  }

  /** POST /departments — create department */
  @Post()
  create(@CompanyId() companyId: string, @Body() dto: CreateDepartmentDto) {
    return this.service.create(companyId, dto);
  }

  /** PATCH /departments/:id — rename department */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.service.update(id, companyId, dto);
  }

  /** PATCH /departments/:id/archive — archive department */
  @Patch(':id/archive')
  archive(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.service.archive(id, companyId);
  }

  /** PATCH /departments/:id/restore — restore archived department */
  @Patch(':id/restore')
  restore(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.service.restore(id, companyId);
  }
}
