import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SignUpDto, SignInDto, ForgotPasswordDto } from './auth.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @Post('signup')
  async signUp(@Body() dto: SignUpDto) {
    return this.authService.signUp(dto.email, dto.password, dto.name, dto.companyName);
  }

  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @Post('signin')
  async signIn(@Body() dto: SignInDto) {
    return this.authService.signIn(dto.email, dto.password);
  }

  @Post('signout')
  async signOut() {
    return this.authService.signOut();
  }

  /**
   * Send a password reset email to the currently authenticated user (settings page flow).
   */
  @Post('request-password-reset')
  @UseGuards(AuthGuard)
  async requestPasswordReset(
    @CurrentUser() user: { id: string; email: string },
  ) {
    return this.authService.requestPasswordReset(user.id, user.email);
  }

  /**
   * Public forgot-password flow (login page — no auth required).
   * Always returns 200 to prevent email enumeration.
   */
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getCurrentUser(@CurrentUser() user: any) {
    // User already verified + fetched by TenantContextMiddleware — return directly.
    // This avoids a second supabase.auth.getUser() call on every /auth/me request.
    return user;
  }
}
