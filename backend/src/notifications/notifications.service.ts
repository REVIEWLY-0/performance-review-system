import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../common/services/prisma.service';
import { LoggerService } from '../common/services/logger.service';

// ============================================================================
// DTOs
// ============================================================================

export interface EmailNotification {
  to: string;
  subject: string;
  html: string;
  text?: string; // Plain-text fallback
}

export interface NotificationPreferences {
  cycleStarted: boolean;
  reviewAssigned: boolean;
  reminders: boolean;
  scoreAvailable: boolean;
}

// ============================================================================
// Service
// ============================================================================

@Injectable()
export class NotificationsService {
  private readonly logger: LoggerService;
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromEmail: string;

  constructor(private prisma: PrismaService) {
    this.logger = new LoggerService();
    this.logger.setContext('NotificationsService');

    const host = process.env.MAILTRAP_HOST;
    const port = process.env.MAILTRAP_PORT;
    const user = process.env.MAILTRAP_USER;
    const pass = process.env.MAILTRAP_PASS;
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@reviewly.com';

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: port ? parseInt(port, 10) : 587,
        auth: { user, pass },
      });
      this.logger.log('Email service initialized with Mailtrap (Nodemailer)');
    } else {
      this.logger.warn('MAILTRAP credentials not set — emails will be logged to console only');
    }
  }

  // ============================================================================
  // Core Email Sending
  // ============================================================================

  private async sendEmail(notification: EmailNotification): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[DEV MODE] Email to ${notification.to}`);
      this.logger.log(`Subject: ${notification.subject}`);
      if (notification.text) {
        this.logger.log(`Body: ${notification.text.substring(0, 200)}`);
      }
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.fromEmail,
        to: notification.to,
        subject: notification.subject,
        html: notification.html,
        text: notification.text,
      });

      this.logger.log(`Email sent to ${notification.to}: ${notification.subject} (messageId: ${info.messageId})`);
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${notification.to}: ${error.message}`);
      throw error;
    }
  }

  // ============================================================================
  // Email Templates
  // ============================================================================

  private cycleStartedTemplate(
    userName: string,
    cycleName: string,
    endDate: string,
  ): { html: string; text: string } {
    const deadline = new Date(endDate).toLocaleDateString();
    const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/employee`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .button { display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Review Cycle Started</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <p>A new performance review cycle has started:</p>
            <p><strong>${cycleName}</strong></p>
            <p>Deadline: <strong>${deadline}</strong></p>
            <p>Please complete your self-review and any assigned peer reviews before the deadline.</p>
            <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
          </div>
          <div class="footer">
            <p>This is an automated message from Reviewly.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
New Review Cycle Started

Hi ${userName},

A new performance review cycle has started: ${cycleName}

Deadline: ${deadline}

Please complete your self-review and any assigned peer reviews before the deadline.

Go to your dashboard: ${dashboardUrl}

This is an automated message from Reviewly.
    `;

    return { html, text: text.trim() };
  }

  private reviewAssignedTemplate(
    reviewerName: string,
    employeeName: string,
    reviewType: string,
    cycleName: string,
  ): { html: string; text: string } {
    const type = reviewType === 'MANAGER' ? 'manager review' : 'peer review';
    const reviewsUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/manager/reviews`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .button { display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Review Assigned</h1>
          </div>
          <div class="content">
            <p>Hi ${reviewerName},</p>
            <p>You have been assigned a ${type} for <strong>${employeeName}</strong> in the <strong>${cycleName}</strong> cycle.</p>
            <p>Please complete the review at your earliest convenience.</p>
            <a href="${reviewsUrl}" class="button">Complete Review</a>
          </div>
          <div class="footer">
            <p>This is an automated message from Reviewly.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Review Assigned

Hi ${reviewerName},

You have been assigned a ${type} for ${employeeName} in the ${cycleName} cycle.

Please complete the review at your earliest convenience.

Complete your review: ${reviewsUrl}

This is an automated message from Reviewly.
    `;

    return { html, text: text.trim() };
  }

  private reminderTemplate(
    userName: string,
    pendingCount: number,
    cycleName: string,
    daysLeft: number,
  ): { html: string; text: string } {
    const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/employee`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .warning { background-color: #fef3c7; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .button { display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Review Deadline Approaching</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <div class="warning">
              <strong>Reminder:</strong> You have <strong>${pendingCount}</strong> pending review(s) in the <strong>${cycleName}</strong> cycle.
            </div>
            <p>Deadline in <strong>${daysLeft} days</strong>!</p>
            <p>Please complete your pending reviews to ensure timely feedback.</p>
            <a href="${dashboardUrl}" class="button">Complete Reviews</a>
          </div>
          <div class="footer">
            <p>This is an automated message from Reviewly.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Review Deadline Approaching

Hi ${userName},

Reminder: You have ${pendingCount} pending review(s) in the ${cycleName} cycle.

Deadline in ${daysLeft} days!

Please complete your pending reviews to ensure timely feedback.

Complete your reviews: ${dashboardUrl}

This is an automated message from Reviewly.
    `;

    return { html, text: text.trim() };
  }

  private scoreAvailableTemplate(
    employeeName: string,
    score: number,
    cycleName: string,
  ): { html: string; text: string } {
    const scoresUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/employee/scores`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #10b981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .score-box { background-color: #d1fae5; padding: 20px; border-radius: 6px; text-align: center; margin: 20px 0; }
          .score { font-size: 48px; font-weight: bold; color: #10b981; }
          .button { display: inline-block; padding: 12px 24px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Your Review Score is Ready</h1>
          </div>
          <div class="content">
            <p>Hi ${employeeName},</p>
            <p>Your performance review score for <strong>${cycleName}</strong> is now available!</p>
            <div class="score-box">
              <div class="score">${score.toFixed(2)}</div>
              <div>out of 5.00</div>
            </div>
            <p>View your detailed feedback and score breakdown in your dashboard.</p>
            <a href="${scoresUrl}" class="button">View Details</a>
          </div>
          <div class="footer">
            <p>This is an automated message from Reviewly.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Your Review Score is Ready

Hi ${employeeName},

Your performance review score for ${cycleName} is now available!

Score: ${score.toFixed(2)} out of 5.00

View your detailed feedback and score breakdown in your dashboard.

View details: ${scoresUrl}

This is an automated message from Reviewly.
    `;

    return { html, text: text.trim() };
  }

  // ============================================================================
  // Public Notification Methods
  // ============================================================================

  async sendCycleStartedNotifications(
    cycleId: string,
    companyId: string,
  ): Promise<void> {
    this.logger.log(`📧 Sending cycle started notifications for cycle ${cycleId}`);

    const cycle = await this.prisma.reviewCycle.findFirst({
      where: { id: cycleId, companyId },
    });

    if (!cycle) {
      this.logger.error('Cycle not found');
      return;
    }

    // Get all employees in the company (include prefs for opt-out check)
    const employees = await this.prisma.user.findMany({
      where: { companyId, role: 'EMPLOYEE' },
      select: { id: true, email: true, name: true, notificationPreferences: true },
    });

    this.logger.log(`Sending to ${employees.length} employees`);

    for (const employee of employees) {
      const prefs = this.getPrefsFromRaw(employee.notificationPreferences);
      if (!prefs.cycleStarted) {
        this.logger.log(`Skipping cycle started email for ${employee.email} (opted out)`);
        continue;
      }

      const cycleTemplate = this.cycleStartedTemplate(
        employee.name,
        cycle.name,
        cycle.endDate.toISOString(),
      );
      await this.sendEmail({
        to: employee.email,
        subject: `New Review Cycle: ${cycle.name}`,
        html: cycleTemplate.html,
        text: cycleTemplate.text,
      });
    }
  }

  async sendReviewAssignedNotification(
    reviewerId: string,
    employeeId: string,
    reviewType: 'MANAGER' | 'PEER',
    cycleId: string,
  ): Promise<void> {
    this.logger.log(
      `📧 Sending review assigned notification to reviewer ${reviewerId}`,
    );

    const [reviewer, employee, cycle] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: reviewerId } }),
      this.prisma.user.findUnique({ where: { id: employeeId } }),
      this.prisma.reviewCycle.findUnique({ where: { id: cycleId } }),
    ]);

    if (!reviewer || !employee || !cycle) {
      this.logger.error('Reviewer, employee, or cycle not found');
      return;
    }

    const prefs = this.getPrefsFromRaw(reviewer.notificationPreferences);
    if (!prefs.reviewAssigned) {
      this.logger.log(`Skipping review assigned email for ${reviewer.email} (opted out)`);
      return;
    }

    const assignedTemplate = this.reviewAssignedTemplate(
      reviewer.name,
      employee.name,
      reviewType,
      cycle.name,
    );
    await this.sendEmail({
      to: reviewer.email,
      subject: `Review Assigned: ${employee.name}`,
      html: assignedTemplate.html,
      text: assignedTemplate.text,
    });
  }

  async sendPendingReviewReminders(): Promise<void> {
    this.logger.log('📧 Checking for pending review reminders');

    // Get active cycles ending in 3 days
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const cycles = await this.prisma.reviewCycle.findMany({
      where: {
        status: 'ACTIVE',
        endDate: {
          lte: threeDaysFromNow,
          gte: new Date(),
        },
      },
      include: {
        company: true,
      },
    });

    this.logger.log(`Found ${cycles.length} cycles with upcoming deadlines`);

    for (const cycle of cycles) {
      const daysLeft = Math.ceil(
        (cycle.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );

      // Get users with pending reviews
      const reviews = await this.prisma.review.findMany({
        where: {
          reviewCycleId: cycle.id,
          status: { not: 'SUBMITTED' },
        },
        include: {
          reviewer: true,
        },
      });

      // Group by reviewer
      const reviewsByUser = new Map<string, number>();
      reviews.forEach((review) => {
        const count = reviewsByUser.get(review.reviewerId) || 0;
        reviewsByUser.set(review.reviewerId, count + 1);
      });

      this.logger.log(
        `Sending reminders to ${reviewsByUser.size} users for cycle ${cycle.name}`,
      );

      for (const [userId, pendingCount] of reviewsByUser) {
        const user = reviews.find((r) => r.reviewerId === userId)?.reviewer;
        if (user) {
          const prefs = this.getPrefsFromRaw(user.notificationPreferences);
          if (!prefs.reminders) {
            this.logger.log(`Skipping reminder for ${user.email} (opted out)`);
            continue;
          }

          const reminderTpl = this.reminderTemplate(
            user.name,
            pendingCount,
            cycle.name,
            daysLeft,
          );
          await this.sendEmail({
            to: user.email,
            subject: `Reminder: ${pendingCount} Pending Reviews`,
            html: reminderTpl.html,
            text: reminderTpl.text,
          });
        }
      }
    }
  }

  async sendScoreAvailableNotification(
    employeeId: string,
    cycleId: string,
    score: number,
  ): Promise<void> {
    this.logger.log(
      `📧 Sending score available notification to employee ${employeeId}`,
    );

    const [employee, cycle] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: employeeId } }),
      this.prisma.reviewCycle.findUnique({ where: { id: cycleId } }),
    ]);

    if (!employee || !cycle) {
      this.logger.error('Employee or cycle not found');
      return;
    }

    const prefs = this.getPrefsFromRaw(employee.notificationPreferences);
    if (!prefs.scoreAvailable) {
      this.logger.log(`Skipping score available email for ${employee.email} (opted out)`);
      return;
    }

    const scoreTemplate = this.scoreAvailableTemplate(employee.name, score, cycle.name);
    await this.sendEmail({
      to: employee.email,
      subject: `Your Review Score for ${cycle.name}`,
      html: scoreTemplate.html,
      text: scoreTemplate.text,
    });
  }

  // ============================================================================
  // Notification Preferences
  // ============================================================================

  /**
   * Safely parse raw JSON preference field from the database.
   * Absent or null field means all notifications are ON (opt-out model).
   */
  private getPrefsFromRaw(raw: unknown): NotificationPreferences {
    if (raw && typeof raw === 'object') {
      const p = raw as Partial<NotificationPreferences>;
      return {
        cycleStarted: p.cycleStarted !== false,
        reviewAssigned: p.reviewAssigned !== false,
        reminders: p.reminders !== false,
        scoreAvailable: p.scoreAvailable !== false,
      };
    }
    return { cycleStarted: true, reviewAssigned: true, reminders: true, scoreAvailable: true };
  }

  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true },
    });

    if (user?.notificationPreferences) {
      return user.notificationPreferences as unknown as NotificationPreferences;
    }

    // Default: all enabled
    return {
      cycleStarted: true,
      reviewAssigned: true,
      reminders: true,
      scoreAvailable: true,
    };
  }

  async updateUserPreferences(
    userId: string,
    preferences: NotificationPreferences,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { notificationPreferences: preferences as unknown as any },
    });

    this.logger.log(`Updated notification preferences for user ${userId}`);
  }

  // ============================================================================
  // Welcome Email
  // ============================================================================

  private welcomeEmailTemplate(userName: string, companyName: string, setupLink?: string): { html: string; text: string } {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4f46e5; color: white; padding: 30px 20px; text-align: center; }
          .content { padding: 30px 20px; background-color: #f9fafb; }
          .button { display: inline-block; padding: 14px 28px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: 600; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .highlight { background-color: #e0e7ff; padding: 15px; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to Reviewly!</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <p>Welcome to <strong>${companyName}</strong>'s performance review system!</p>
            <div class="highlight">
              <p><strong>Your account is now active.</strong> You can start participating in performance reviews and tracking your progress.</p>
            </div>
            <p><strong>What you can do:</strong></p>
            <ul>
              <li>Complete self-reviews when cycles start</li>
              <li>Provide peer feedback when assigned</li>
              <li>View your performance scores and feedback</li>
              <li>Track your progress over time</li>
            </ul>
            ${setupLink
              ? `<p>Set up your password to get started:</p>
            <a href="${setupLink}" class="button">Set Up Password</a>
            <p style="margin-top:12px;font-size:13px;color:#6b7280;">After setting your password you can sign in at <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login">${process.env.FRONTEND_URL || 'http://localhost:3000'}/login</a></p>`
              : `<p>Get started by logging in to your dashboard:</p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" class="button">Go to Dashboard</a>`
            }
          </div>
          <div class="footer">
            <p>Questions? Contact your HR administrator.</p>
            <p>This is an automated message from Reviewly.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Welcome to Reviewly!

Hi ${userName},

Welcome to ${companyName}'s performance review system!

Your account is now active. You can start participating in performance reviews and tracking your progress.

What you can do:
- Complete self-reviews when cycles start
- Provide peer feedback when assigned
- View your performance scores and feedback
- Track your progress over time

${setupLink
      ? `Set up your password to get started:\n${setupLink}\n\nAfter setting your password, sign in at:\n${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`
      : `Get started by logging in to your dashboard:\n${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`
    }

Questions? Contact your HR administrator.
This is an automated message from Reviewly.
    `;

    return { html, text: text.trim() };
  }

  async sendWelcomeEmail(userId: string, setupLink?: string): Promise<void> {
    this.logger.log(`Sending welcome email to user ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user) {
      this.logger.error('User not found');
      return;
    }

    const template = this.welcomeEmailTemplate(user.name, user.company.name, setupLink);

    await this.sendEmail({
      to: user.email,
      subject: `Welcome to ${user.company.name}'s Reviewly!`,
      html: template.html,
      text: template.text,
    });
  }

  // ============================================================================
  // Test Email
  // ============================================================================

  async sendTestEmail(toEmail: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.transporter) {
        return {
          success: false,
          message: 'Email service not configured. Set MAILTRAP_HOST, MAILTRAP_USER, and MAILTRAP_PASS environment variables.',
        };
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #10b981; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Email Service Test Successful!</h1>
            </div>
            <div class="content">
              <p>This is a test email from Reviewly.</p>
              <p>If you're seeing this, your email configuration is working correctly!</p>
              <p><strong>Configuration:</strong></p>
              <ul>
                <li>From: ${this.fromEmail}</li>
                <li>Service: Resend</li>
                <li>Environment: ${process.env.NODE_ENV || 'development'}</li>
              </ul>
            </div>
          </div>
        </body>
        </html>
      `;

      const text = `
Email Service Test Successful!

This is a test email from Reviewly.
If you're seeing this, your email configuration is working correctly!

Configuration:
- From: ${this.fromEmail}
- Service: Resend
- Environment: ${process.env.NODE_ENV || 'development'}
      `;

      await this.sendEmail({
        to: toEmail,
        subject: 'Reviewly - Email Service Test',
        html,
        text: text.trim(),
      });

      return {
        success: true,
        message: `Test email sent successfully to ${toEmail}`,
      };
    } catch (error: any) {
      this.logger.error(`Test email failed: ${error.message}`);
      return {
        success: false,
        message: `Failed to send test email: ${error.message}`,
      };
    }
  }
}
