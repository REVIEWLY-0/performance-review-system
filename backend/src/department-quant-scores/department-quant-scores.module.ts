import { Module } from '@nestjs/common';
import { DepartmentQuantScoresController } from './department-quant-scores.controller';
import { DepartmentQuantScoresService } from './department-quant-scores.service';
import { PrismaService } from '../common/services/prisma.service';

@Module({
  controllers: [DepartmentQuantScoresController],
  providers: [DepartmentQuantScoresService, PrismaService],
  exports: [DepartmentQuantScoresService],
})
export class DepartmentQuantScoresModule {}
