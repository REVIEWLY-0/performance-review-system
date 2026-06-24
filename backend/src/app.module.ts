import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { SentryModule } from '@sentry/nestjs/setup';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { QuestionsModule } from './questions/questions.module';
import { ReviewCyclesModule } from './review-cycles/review-cycles.module';
import { ReviewerAssignmentsModule } from './reviewer-assignments/reviewer-assignments.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ScoringModule } from './scoring/scoring.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthModule } from './health/health.module';
import { ReviewTypeConfigsModule } from './review-type-configs/review-type-configs.module';
import { DepartmentsModule } from './departments/departments.module';
import { RatingScaleModule } from './rating-scale/rating-scale.module';
import { OrgChartModule } from './org-chart/org-chart.module';
import { ScoreWeightsModule } from './score-weights/score-weights.module';
import { GoalsModule } from './goals/goals.module';
import { DepartmentQuantScoresModule } from './department-quant-scores/department-quant-scores.module';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { PrismaService } from './common/services/prisma.service';

@Module({
  imports: [
    SentryModule.forRoot(),
    // Rate limiting
    // - default: 300 req/min per IP (covers dashboard burst of 20-30 parallel fetches)
    // - auth routes (signin/signup/forgot-password) override this via @Throttle on AuthController
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60 * 1000, // 1 minute
        limit: 300,
      },
    ]),
    AuthModule,
    UsersModule,
    QuestionsModule,
    ReviewCyclesModule,
    ReviewerAssignmentsModule,
    ReviewsModule,
    ScoringModule,
    AnalyticsModule,
    NotificationsModule,
    HealthModule,
    ReviewTypeConfigsModule,
    DepartmentsModule,
    RatingScaleModule,
    OrgChartModule,
    ScoreWeightsModule,
    GoalsModule,
    DepartmentQuantScoresModule,
  ],
  providers: [
    PrismaService,
    // Catch all unhandled exceptions and report to Sentry
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
    // Apply rate limiting globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply request logger to all routes
    consumer.apply(LoggerMiddleware).forRoutes('*');

    // Apply tenant context middleware to all routes except auth and health
    consumer
      .apply(TenantContextMiddleware)
      .exclude('auth/signin', 'auth/signup', 'auth/forgot-password', 'health', 'notifications/unsubscribe')
      .forRoutes('*');

    // CSRF defense-in-depth: validates Origin header on mutations in production
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
