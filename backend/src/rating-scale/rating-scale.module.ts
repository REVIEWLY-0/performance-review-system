import { Module } from '@nestjs/common';
import { RatingScaleController } from './rating-scale.controller';
import { RatingScaleService } from './rating-scale.service';
import { PrismaService } from '../common/services/prisma.service';

@Module({
  controllers: [RatingScaleController],
  providers: [RatingScaleService, PrismaService],
  exports: [RatingScaleService],
})
export class RatingScaleModule {}
