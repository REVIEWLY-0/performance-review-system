import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../common/services/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReviewTypeConfigsModule } from '../review-type-configs/review-type-configs.module';

@Module({
  imports: [NotificationsModule, ReviewTypeConfigsModule],
  controllers: [AuthController],
  providers: [AuthService, PrismaService],
  exports: [AuthService],
})
export class AuthModule {}
