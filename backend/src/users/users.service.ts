import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../common/services/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole } from '@prisma/client';
import {
  IsEmail, IsString, IsEnum, IsOptional, IsArray, ValidateNested,
  MinLength, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsOptional()
  @IsString()
  managerId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  department!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  employeeId?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  managerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;
}

export class UpdateProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
}

export class ImportUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  role!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  department!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  employeeId?: string;

  @IsOptional()
  @IsEmail()
  managerEmail?: string;
}

export class ImportUsersBodyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportUserDto)
  users!: ImportUserDto[];
}

@Injectable()
export class UsersService {
  private supabase: SupabaseClient;

  /** Generate a human-readable HR employee ID — format: EMP-XXXXXX (uppercase alphanumeric) */
  private generateEmployeeId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return `EMP-${id}`;
  }

  /** Return a unique employeeId for a company — retries up to 5x on collision */
  private async resolveEmployeeId(companyId: string, requested?: string): Promise<string> {
    if (requested) {
      const existing = await this.prisma.user.findFirst({
        where: { companyId, employeeId: requested },
      });
      if (existing) {
        throw new BadRequestException(`Employee ID "${requested}" already exists in your company`);
      }
      return requested;
    }
    // Auto-generate, retrying on the rare collision
    for (let attempt = 0; attempt < 5; attempt++) {
      const id = this.generateEmployeeId();
      const existing = await this.prisma.user.findFirst({ where: { companyId, employeeId: id } });
      if (!existing) return id;
    }
    throw new BadRequestException('Could not generate a unique employee ID — please try again');
  }

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }

  /**
   * CRITICAL: Find all users - MUST filter by companyId
   */
  async findAll(companyId: string, page = 1, limit = 50) {
    const safeLimit = Math.min(limit, 200);
    const skip = (page - 1) * safeLimit;

    const where = { companyId };
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          manager: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          directReports: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  /**
   * CRITICAL: Find user by ID - MUST filter by companyId
   */
  async findOne(userId: string, companyId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
      },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        directReports: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        teamMemberships: {
          include: {
            team: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Create new user - automatically assigns companyId
   */
  async create(companyId: string, createUserDto: CreateUserDto) {
    const { email, name, role, managerId, department, employeeId: requestedEmpId } = createUserDto;

    // Check if email already exists in company
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email,
        companyId,
      },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists in your company');
    }

    // If manager is specified, verify they exist in same company
    if (managerId) {
      const manager = await this.prisma.user.findFirst({
        where: {
          id: managerId,
          companyId,
        },
      });

      if (!manager) {
        throw new BadRequestException('Manager not found in your company');
      }
    }

    // Provision Supabase auth account so the employee can sign in
    let supabaseId: string | undefined;
    let setupLink: string | undefined;

    const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
      email,
      email_confirm: true, // Skip confirmation email — we send our own
    });

    if (authError) {
      // If account already exists in Supabase, look up by email directly (avoids fetching all users)
      if (authError.message?.toLowerCase().includes('already registered') || authError.code === 'email_exists') {
        const { data: existingData } = await this.supabase.auth.admin.listUsers({ perPage: 1 });
        // Use getUserByEmail via filter — fall back to searching with email filter
        const { data: byEmail } = await (this.supabase.auth.admin as any).getUserByEmail?.(email)
          ?? { data: null };
        if (byEmail?.user?.id) {
          supabaseId = byEmail.user.id;
        } else {
          // Last resort: targeted search (page 1, small set)
          const { data: listData } = await this.supabase.auth.admin.listUsers({ perPage: 1000 });
          supabaseId = listData?.users?.find((u) => u.email === email)?.id;
        }
      } else {
        console.error('Supabase auth creation failed for new user:', authError.message);
      }
    } else {
      supabaseId = authData.user?.id;
    }

    // Resolve (or generate) the HR employee ID
    const resolvedEmpId = await this.resolveEmployeeId(companyId, requestedEmpId);

    // Generate a password-setup link so the employee can log in for the first time
    if (supabaseId) {
      const { data: linkData, error: linkError } = await this.supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
      });
      if (!linkError && linkData?.properties?.action_link) {
        setupLink = linkData.properties.action_link;
      }
    }

    const user = await this.prisma.user.create({
      data: {
        // Use Supabase UUID so sign-in can find this record; fall back to cuid
        ...(supabaseId ? { id: supabaseId } : {}),
        email,
        name,
        role,
        companyId,
        managerId,
        department,
        employeeId: resolvedEmpId,
        password: '', // Password managed by Supabase
      },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Fire welcome email with setup link — non-blocking
    this.notificationsService
      .sendWelcomeEmail(user.id, setupLink)
      .catch((err) => console.error('Welcome email failed for new user:', err));

    return user;
  }

  /**
   * Update user - MUST verify companyId
   */
  async update(userId: string, companyId: string, updateUserDto: UpdateUserDto) {
    // Verify user exists in company
    await this.findOne(userId, companyId);

    // If updating manager, verify manager exists in company
    if (updateUserDto.managerId) {
      const manager = await this.prisma.user.findFirst({
        where: {
          id: updateUserDto.managerId,
          companyId,
        },
      });

      if (!manager) {
        throw new BadRequestException('Manager not found in your company');
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateUserDto,
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Soft delete user (we don't actually delete, just mark as inactive)
   * For now, we'll actually delete, but in production you'd add an 'active' field
   */
  async remove(userId: string, companyId: string) {
    // Verify user exists in company
    await this.findOne(userId, companyId);

    // Check if user has direct reports
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        directReports: true,
      },
    });

    if (user?.directReports && user.directReports.length > 0) {
      throw new BadRequestException(
        'Cannot delete user with direct reports. Reassign them first.',
      );
    }

    return this.prisma.user.delete({
      where: { id: userId },
    });
  }

  /**
   * Get all managers in company (for dropdown)
   * Hard cap at 200 — dropdown doesn't need pagination
   */
  async getManagers(companyId: string) {
    return this.prisma.user.findMany({
      where: {
        companyId,
        role: {
          in: ['MANAGER', 'ADMIN'],
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: {
        name: 'asc',
      },
      take: 200,
    });
  }

  /**
   * Import users from Excel data
   * CRITICAL: All imports are scoped to companyId
   */
  async importUsers(companyId: string, users: ImportUserDto[]) {
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    // First pass: create all users without managers
    const createdUsers = new Map<string, string>(); // email -> id

    for (const userData of users) {
      try {
        // Validate role
        if (!['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(userData.role.toUpperCase())) {
          results.failed++;
          results.errors.push(`Invalid role for ${userData.email}: ${userData.role}`);
          continue;
        }

        // Check if user already exists
        const existing = await this.prisma.user.findFirst({
          where: {
            email: userData.email,
            companyId,
          },
        });

        if (existing) {
          results.failed++;
          results.errors.push(`User already exists: ${userData.email}`);
          continue;
        }

        // Provision Supabase auth account (non-fatal — import must not abort on auth errors)
        let importSupabaseId: string | undefined;
        let importSetupLink: string | undefined;

        const { data: importAuthData, error: importAuthError } = await this.supabase.auth.admin.createUser({
          email: userData.email,
          email_confirm: true,
        });

        if (importAuthError) {
          if (importAuthError.message?.toLowerCase().includes('already registered') || importAuthError.code === 'email_exists') {
            // Targeted lookup — avoid fetching all Supabase users on every collision
            const { data: byEmail } = await (this.supabase.auth.admin as any).getUserByEmail?.(userData.email)
              ?? { data: null };
            if (byEmail?.user?.id) {
              importSupabaseId = byEmail.user.id;
            } else {
              const { data: listData } = await this.supabase.auth.admin.listUsers({ perPage: 1000 });
              importSupabaseId = listData?.users?.find((u) => u.email === userData.email)?.id;
            }
          }
          // else: log silently and continue without a Supabase ID
        } else {
          importSupabaseId = importAuthData.user?.id;
        }

        if (importSupabaseId) {
          const { data: linkData } = await this.supabase.auth.admin.generateLink({
            type: 'recovery',
            email: userData.email,
          });
          if (linkData?.properties?.action_link) {
            importSetupLink = linkData.properties.action_link;
          }
        }

        // Resolve (or auto-generate) the HR employee ID
        let importEmpId: string;
        try {
          importEmpId = await this.resolveEmployeeId(companyId, userData.employeeId);
        } catch (err: any) {
          results.failed++;
          results.errors.push(`Row for ${userData.email}: ${err.message}`);
          continue;
        }

        // Create user without manager first
        const user = await this.prisma.user.create({
          data: {
            ...(importSupabaseId ? { id: importSupabaseId } : {}),
            email: userData.email,
            name: userData.name,
            role: userData.role.toUpperCase() as UserRole,
            companyId,
            department: userData.department,
            employeeId: importEmpId,
            password: '', // Managed by Supabase
          },
        });

        createdUsers.set(userData.email, user.id);
        results.successful++;

        // Fire welcome email with setup link — non-blocking, failure must not affect import results
        this.notificationsService
          .sendWelcomeEmail(user.id, importSetupLink)
          .catch(() => { /* welcome email failure is silent during bulk import */ });
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Error creating ${userData.email}: ${error.message}`);
      }
    }

    // Second pass: assign managers
    for (const userData of users) {
      if (userData.managerEmail && createdUsers.has(userData.email)) {
        try {
          // Find manager by email in same company
          const manager = await this.prisma.user.findFirst({
            where: {
              email: userData.managerEmail,
              companyId,
            },
          });

          if (manager) {
            const userId = createdUsers.get(userData.email);
            await this.prisma.user.update({
              where: { id: userId },
              data: { managerId: manager.id },
            });
          }
        } catch (error: any) {
          // Manager assignment failed, but user was created
          results.errors.push(
            `Could not assign manager for ${userData.email}: ${error.message}`,
          );
        }
      }
    }

    return results;
  }

  /**
   * Update the current user's own profile (name only)
   * No admin required — any authenticated user may update their own name
   */
  async updateProfile(userId: string, companyId: string, name: string) {
    // Verify the user exists within this company (tenant guard)
    await this.findOne(userId, companyId);

    return this.prisma.user.update({
      where: { id: userId },
      data: { name },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyId: true,
      },
    });
  }

  /**
   * Get distinct department names for the company
   * CRITICAL: Always filter by companyId for multi-tenancy
   */
  async getDepartments(companyId: string): Promise<string[]> {
    const rows = await this.prisma.user.findMany({
      where: { companyId, department: { not: null } },
      select: { department: true },
      distinct: ['department'],
      orderBy: { department: 'asc' },
    });
    return rows.map((r) => r.department!).filter(Boolean);
  }

  /**
   * Get user statistics
   */
  async getStats(companyId: string) {
    // Single query instead of 4 — uses the (companyId, role) composite index
    const groups = await this.prisma.user.groupBy({
      by: ['role'],
      where: { companyId },
      _count: { _all: true },
    });

    const count = (role: string) =>
      groups.find((g) => g.role === role)?._count._all ?? 0;
    const total = groups.reduce((sum, g) => sum + g._count._all, 0);

    return {
      total,
      byRole: {
        admins: count('ADMIN'),
        managers: count('MANAGER'),
        employees: count('EMPLOYEE'),
      },
    };
  }
}
