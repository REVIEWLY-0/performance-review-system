import { Module } from '@nestjs/common';
import { ScoreWeightsService } from './score-weights.service';
import { ScoreWeightsController } from './score-weights.controller';
import { PrismaService } from '../common/services/prisma.service';

@Module({
  providers: [ScoreWeightsService, PrismaService],
  controllers: [ScoreWeightsController],
  exports: [ScoreWeightsService],
})
export class ScoreWeightsModule {}
