import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

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
    const { email, name, role, managerId } = createUserDto;

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

    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        role,
        companyId,
        managerId,
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

    // Fire welcome email — non-blocking, a failure must not roll back user creation
    this.notificationsService
      .sendWelcomeEmail(user.id)
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

        // Create user without manager first
        const user = await this.prisma.user.create({
          data: {
            email: userData.email,
            name: userData.name,
            role: userData.role.toUpperCase() as UserRole,
            companyId,
            password: '', // Managed by Supabase
          },
        });

        createdUsers.set(userData.email, user.id);
        results.successful++;

        // Fire welcome email — non-blocking, failure must not affect import results
        this.notificationsService
          .sendWelcomeEmail(user.id)
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
   * Get user statistics
   */
  async getStats(companyId: string) {
    const [total, admins, managers, employees] = await Promise.all([
      this.prisma.user.count({ where: { companyId } }),
      this.prisma.user.count({ where: { companyId, role: 'ADMIN' } }),
      this.prisma.user.count({ where: { companyId, role: 'MANAGER' } }),
      this.prisma.user.count({ where: { companyId, role: 'EMPLOYEE' } }),
    ]);

    return {
      total,
      byRole: {
        admins,
        managers,
        employees,
      },
    };
  }
}
