import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { PrismaService } from './common/services/prisma.service';

@Module({
  imports: [
    // Rate limiting - 10 requests per second per IP
    ThrottlerModule.forRoot([
      {
        ttl: 1000, // 1 second
        limit: 10, // 10 requests
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
  ],
  providers: [
    PrismaService,
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
      .exclude('auth/signin', 'auth/signup', 'health', 'notifications/unsubscribe')
      .forRoutes('*');
  }
}
