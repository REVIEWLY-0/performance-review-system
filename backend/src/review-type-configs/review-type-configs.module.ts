import { Module } from '@nestjs/common';
import { ReviewTypeConfigsController } from './review-type-configs.controller';
import { ReviewTypeConfigsService } from './review-type-configs.service';
import { PrismaService } from '../common/services/prisma.service';

@Module({
  controllers: [ReviewTypeConfigsController],
  providers: [ReviewTypeConfigsService, PrismaService],
  exports: [ReviewTypeConfigsService],
})
export class ReviewTypeConfigsModule {}
