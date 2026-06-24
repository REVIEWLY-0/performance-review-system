import { Module, forwardRef } from '@nestjs/common';
import { ScoringController } from './scoring.controller';
import { ScoringService } from './scoring.service';
import { PrismaService } from '../common/services/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ScoreWeightsModule } from '../score-weights/score-weights.module';
import { DepartmentQuantScoresModule } from '../department-quant-scores/department-quant-scores.module';

@Module({
  imports: [
    forwardRef(() => NotificationsModule),
    forwardRef(() => ScoreWeightsModule),
    DepartmentQuantScoresModule,
  ],
  controllers: [ScoringController],
  providers: [ScoringService, PrismaService],
  exports: [ScoringService],
})
export class ScoringModule {}
