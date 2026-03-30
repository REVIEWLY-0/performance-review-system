import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
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
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { PrismaService } from './common/services/prisma.service';

@Module({
  imports: [
    SentryModule.forRoot(),
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
  ],
  providers: [
    PrismaService,
    // Catch all unhandled exceptions and report to Sentry
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
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
      .exclude('auth/signin', 'auth/signup', 'health', 'notifications/unsubscribe')
      .forRoutes('*');

    // CSRF defense-in-depth: validates Origin header on mutations in production
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
