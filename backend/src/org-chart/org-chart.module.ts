import { Module } from '@nestjs/common';
import { OrgChartService } from './org-chart.service';
import { OrgChartController } from './org-chart.controller';
import { PrismaService } from '../common/services/prisma.service';

@Module({
  controllers: [OrgChartController],
  providers: [OrgChartService, PrismaService],
})
export class OrgChartModule {}
