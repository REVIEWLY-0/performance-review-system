import { Controller, Get, Put, Post, Body, UseGuards, Query, Header, Res } from '@nestjs/common';
import { Response } from 'express';
import { NotificationsService, NotificationPreferences } from './notifications.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /notifications/preferences
   * Get user's notification preferences
   */
  @Get('preferences')
  @UseGuards(AuthGuard)
  async getPreferences(@CurrentUser() user: any) {
    return this.notificationsService.getUserPreferences(user.id);
  }

  /**
   * PUT /notifications/preferences
   * Update user's notification preferences
   */
  @Put('preferences')
  @UseGuards(AuthGuard)
  async updatePreferences(
    @CurrentUser() user: any,
    @Body() preferences: NotificationPreferences,
  ) {
    await this.notificationsService.updateUserPreferences(user.id, preferences);
    return { message: 'Notification preferences updated successfully' };
  }

  /**
   * POST /notifications/test
   * Send a test email to verify configuration — ADMIN only
   */
  @Post('test')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async sendTestEmail(@Query('email') email: string, @CurrentUser() user: any) {
    const testEmail = email || user.email;
    return this.notificationsService.sendTestEmail(testEmail);
  }

  /**
   * GET /notifications/unsubscribe?userId=...&token=...
   * One-click unsubscribe — public endpoint (no auth required).
   * Returns an HTML confirmation page so email clients render it directly.
   */
  @Get('unsubscribe')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async unsubscribe(
    @Query('userId') userId: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (!userId || !token) {
      return res.status(400).send(this.unsubscribePage(
        'Invalid Link',
        'This unsubscribe link is missing required parameters.',
        frontendUrl,
      ));
    }

    const result = await this.notificationsService.unsubscribeAll(userId, token);

    if (!result.ok) {
      return res.status(400).send(this.unsubscribePage(
        'Invalid or Expired Link',
        'This unsubscribe link is invalid or has already been used. You can manage your preferences from Settings.',
        frontendUrl,
      ));
    }

    return res.status(200).send(this.unsubscribePage(
      'Unsubscribed Successfully',
      "You've been unsubscribed from all Reviewly email notifications. You can re-enable them anytime from your Settings page.",
      frontendUrl,
    ));
  }

  private unsubscribePage(title: string, message: string, frontendUrl: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Reviewly</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f9fafb; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: white; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,.08); padding: 48px 40px; max-width: 480px; text-align: center; }
    h1 { color: #111827; font-size: 22px; margin: 0 0 16px; }
    p { color: #6b7280; line-height: 1.6; margin: 0 0 28px; }
    a { display: inline-block; background: #4f46e5; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600; }
    a:hover { background: #4338ca; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="${frontendUrl}/settings">Manage Preferences</a>
  </div>
</body>
</html>`;
  }
}
