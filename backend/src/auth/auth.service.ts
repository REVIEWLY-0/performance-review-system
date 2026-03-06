import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../common/services/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials in environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Sign up a new user and create their company
   */
  async signUp(email: string, password: string, name: string, companyName: string) {
    try {
      console.log('📝 Starting signup process for:', email);

      // 1) Create Supabase auth user with admin API (auto-confirmed)
      const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
      });

      if (authError || !authData.user) {
        console.error('❌ Supabase user creation failed:', authError?.message);
        throw new UnauthorizedException(authError?.message || 'Sign up failed');
      }

      const authUserId = authData.user.id;
      console.log('✅ Supabase user created:', authUserId);

      // 2) If this Supabase user already exists in OUR DB, don't create a new company.
      //    This happens a lot during testing / retries.
      const existing = await this.prisma.user.findUnique({
        where: { id: authUserId },
        include: { company: true },
      });

      if (existing) {
        console.log('⚠️  User already exists in database, updating profile');

        // Optional: update profile fields in case they changed
        const updated = await this.prisma.user.update({
          where: { id: authUserId },
          data: { name },
          include: { company: true },
        });

        // Sign in to get a session
        const { data: signInData, error: signInError } = await this.supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          console.error('❌ Sign in failed for existing user:', signInError.message);
          throw new UnauthorizedException(signInError.message);
        }

        console.log('✅ Existing user signed in successfully');

        return {
          user: {
            id: updated.id,
            email: updated.email,
            name: updated.name,
            role: updated.role,
            companyId: updated.companyId,
          },
          session: signInData.session,
          message: 'User already existed; signed in successfully.',
        };
      }

      // 3) Create company (only for first-time signup in our DB)
      const company = await this.prisma.company.create({
        data: { name: companyName },
      });
      console.log('✅ Company created:', company.id);

      // 4) Create user in our database
      const user = await this.prisma.user.create({
        data: {
          id: authUserId, // Use Supabase user ID
          companyId: company.id,
          email,
          name,
          password: '', // Password managed by Supabase
          role: 'ADMIN',
        },
      });
      console.log('✅ User created in database:', user.id);

      // Send welcome email — non-blocking, a failure must not break signup
      this.notificationsService
        .sendWelcomeEmail(user.id)
        .catch((err) => console.error('Welcome email failed after signup:', err));

      // 5) Sign in the newly created user to get a session
      const { data: signInData, error: signInError } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('❌ Sign in failed after signup:', signInError.message);
        throw new UnauthorizedException('User created but sign in failed: ' + signInError.message);
      }

      console.log('✅ New user signed in successfully');

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
        },
        session: signInData.session,
        message: 'Sign up successful! Welcome aboard.',
      };
    } catch (error) {
      console.error('❌ Signup error:', error);
      throw error;
    }
  }

  /**
   * Sign in existing user
   */
  async signIn(email: string, password: string) {
    try {
      console.log('🔑 Attempting sign in for:', email);

      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        console.error('❌ Supabase sign in failed:', error?.message);
        throw new UnauthorizedException(error?.message || 'Invalid credentials');
      }

      console.log('✅ Supabase authentication successful:', data.user.id);

      // Fetch user details from our database
      const user = await this.prisma.user.findUnique({
        where: { id: data.user.id },
        include: {
          company: true,
        },
      });

      if (!user) {
        console.error('❌ User not found in database:', data.user.id);
        throw new UnauthorizedException('User not found in system');
      }

      console.log('✅ Sign in successful for user:', user.email);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
          companyName: user.company.name,
        },
        session: data.session,
      };
    } catch (error) {
      console.error('❌ Sign in error:', error);
      throw error;
    }
  }

  /**
   * Sign out user
   */
  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    if (error) {
      throw new UnauthorizedException('Sign out failed');
    }
    return { message: 'Signed out successfully' };
  }

  /**
   * Verify JWT token and return user info
   */
  async verifyToken(token: string) {
    const { data, error } = await this.supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Fetch user from database with company info
    const user = await this.prisma.user.findUnique({
      where: { id: data.user.id },
      include: {
        company: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      companyName: user.company.name,
    };
  }

  /**
   * Generate a password reset link and send it to the user's email
   */
  async requestPasswordReset(userId: string, email: string): Promise<{ message: string }> {
    const { data: linkData, error: linkError } = await this.supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('Failed to generate password reset link:', linkError?.message);
      throw new BadRequestException('Failed to generate password reset link. Please try again.');
    }

    await this.notificationsService.sendPasswordResetEmail(userId, linkData.properties.action_link);

    return { message: `Password reset email sent to ${email}` };
  }

  /**
   * Get user by ID (with company_id filtering)
   */
  async getUserById(userId: string, companyId: string) {
    // CRITICAL: Always filter by company_id for multi-tenancy
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId: companyId,
      },
      include: {
        company: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or access denied');
    }

    return user;
  }
}
