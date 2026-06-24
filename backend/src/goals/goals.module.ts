import { Module } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { GoalsController } from './goals.controller';
import { PrismaService } from '../common/services/prisma.service';

@Module({
  providers: [GoalsService, PrismaService],
  controllers: [GoalsController],
  exports: [GoalsService],
})
export class GoalsModule {}
