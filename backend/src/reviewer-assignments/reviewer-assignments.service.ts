import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { ReviewerType } from '@prisma/client';
import {
  IsString, IsEnum, IsEmail, IsArray, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAssignmentDto {
  @IsString()
  reviewerId!: string;

  @IsEnum(ReviewerType)
  reviewerType!: ReviewerType;
}

export class BulkCreateAssignmentsDto {
  @IsString()
  reviewCycleId!: string;

  @IsString()
  employeeId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAssignmentDto)
  assignments!: CreateAssignmentDto[];
}

export class ImportAssignmentDto {
  @IsEmail()
  employeeEmail!: string;

  @IsEmail()
  reviewerEmail!: string;

  @IsString()
  reviewerType!: string;
}

export class BulkUpsertBodyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkCreateAssignmentsDto)
  assignments!: BulkCreateAssignmentsDto[];
}

export class ImportAssignmentsBodyDto {
  @IsString()
  reviewCycleId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportAssignmentDto)
  assignments!: ImportAssignmentDto[];
}

@Injectable()
export class ReviewerAssignmentsService {
  constructor(private prisma: PrismaService) {}

  async findByCycle(reviewCycleId: string, companyId: string) {
    console.log(
      `📋 Fetching assignments for cycle: ${reviewCycleId}, company: ${companyId}`,
    );

    await this.validateCycleAccess(reviewCycleId, companyId);

    const assignments = await this.prisma.reviewerAssignment.findMany({
      where: { reviewCycleId },
      include: {
        employee: {
          select: { id: true, name: true, email: true },
        },
        reviewer: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: [
        { employee: { name: 'asc' } },
        { reviewerType: 'asc' },
      ],
    });

    const grouped = new Map();
    for (const assignment of assignments) {
      if (!grouped.has(assignment.employeeId)) {
        grouped.set(assignment.employeeId, {
          employee: assignment.employee,
          managers: [],
          peers: [],
        });
      }
      const group = grouped.get(assignment.employeeId);
      if (assignment.reviewerType === 'MANAGER') {
        group.managers.push(assignment.reviewer);
      } else {
        group.peers.push(assignment.reviewer);
      }
    }

    return Array.from(grouped.values());
  }

  async upsertForEmployee(
    dto: BulkCreateAssignmentsDto,
    companyId: string,
  ) {
    console.log(
      `✏️ Upserting assignments for employee: ${dto.employeeId}, cycle: ${dto.reviewCycleId}`,
    );

    await this.validateCycleAccess(dto.reviewCycleId, companyId);
    await this.validateUserInCompany(dto.employeeId, companyId);

    const reviewerIds = [...new Set(dto.assignments.map((a) => a.reviewerId))];
    await this.validateUsersInCompany(reviewerIds, companyId);

    this.validateAssignments(dto.employeeId, dto.assignments);

    return this.prisma.$transaction(async (prisma) => {
      await prisma.reviewerAssignment.deleteMany({
        where: {
          reviewCycleId: dto.reviewCycleId,
          employeeId: dto.employeeId,
        },
      });
      // Only delete reverse assignments auto-created for this employee's own
      // MANAGER assignments, not assignments where this employee is explicitly
      // a reviewer for someone else (e.g. manager reviewing a direct report).
      const currentManagerAssignments = await prisma.reviewerAssignment.findMany({
        where: {
          reviewCycleId: dto.reviewCycleId,
          employeeId: dto.employeeId,
          reviewerType: 'MANAGER',
        },
        select: { reviewerId: true },
      });

      const currentManagerIds = currentManagerAssignments.map((a) => a.reviewerId);
      if (currentManagerIds.length > 0) {
        await prisma.reviewerAssignment.deleteMany({
          where: {
            reviewCycleId: dto.reviewCycleId,
            employeeId: { in: currentManagerIds },
            reviewerId: dto.employeeId,
            reviewerType: 'MANAGER',
          },
        });
      }

      if (dto.assignments.length > 0) {
        await prisma.reviewerAssignment.createMany({
          data: dto.assignments.map((a) => ({
            reviewCycleId: dto.reviewCycleId,
            employeeId: dto.employeeId,
            reviewerId: a.reviewerId,
            reviewerType: a.reviewerType,
          })),
        });

        const managerAssignments = dto.assignments.filter(
          (a) => a.reviewerType === 'MANAGER',
        );
        if (managerAssignments.length > 0) {
          await prisma.reviewerAssignment.createMany({
            data: managerAssignments.map((a) => ({
              reviewCycleId: dto.reviewCycleId,
              employeeId: a.reviewerId,
              reviewerId: dto.employeeId,
              reviewerType: 'MANAGER',
            })),
            skipDuplicates: true,
          });
        }
      }

      return prisma.reviewerAssignment.findMany({
        where: {
          reviewCycleId: dto.reviewCycleId,
          employeeId: dto.employeeId,
        },
        include: {
          reviewer: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    });
  }

  async bulkUpsert(
    assignments: BulkCreateAssignmentsDto[],
    companyId: string,
  ) {
    console.log(
      `📦 Bulk upserting assignments for ${assignments.length} employees`,
    );

    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const dto of assignments) {
      try {
        await this.upsertForEmployee(dto, companyId);
        results.successful++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(
          `Employee ${dto.employeeId}: ${error.message}`,
        );
      }
    }

    return results;
  }

  async importAssignments(
    reviewCycleId: string,
    assignments: ImportAssignmentDto[],
    companyId: string,
  ) {
    console.log(
      `📥 Importing ${assignments.length} assignments for cycle ${reviewCycleId}`,
    );

    await this.validateCycleAccess(reviewCycleId, companyId);

    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    const users = await this.prisma.user.findMany({
      where: { companyId },
      select: { id: true, email: true, name: true },
    });
    const emailToUser = new Map(
      users.map((u) => [u.email.toLowerCase(), u]),
    );

    const grouped = new Map<string, CreateAssignmentDto[]>();

    for (const assignment of assignments) {
      const employeeEmail = assignment.employeeEmail.toLowerCase();
      const reviewerEmail = assignment.reviewerEmail.toLowerCase();

      const employee = emailToUser.get(employeeEmail);
      const reviewer = emailToUser.get(reviewerEmail);

      if (!employee) {
        results.failed++;
        results.errors.push(`Employee not found: ${assignment.employeeEmail}`);
        continue;
      }

      if (!reviewer) {
        results.failed++;
        results.errors.push(`Reviewer not found: ${assignment.reviewerEmail}`);
        continue;
      }

      const reviewerType = assignment.reviewerType.toUpperCase();
      if (!['MANAGER', 'PEER'].includes(reviewerType)) {
        results.failed++;
        results.errors.push(`Invalid reviewer type: ${assignment.reviewerType}`);
        continue;
      }

      if (!grouped.has(employee.id)) {
        grouped.set(employee.id, []);
      }
      grouped.get(employee.id)!.push({
        reviewerId: reviewer.id,
        reviewerType: reviewerType as ReviewerType,
      });
    }

    for (const [employeeId, employeeAssignments] of grouped) {
      try {
        await this.upsertForEmployee(
          { reviewCycleId, employeeId, assignments: employeeAssignments },
          companyId,
        );
        results.successful += employeeAssignments.length;
      } catch (error: any) {
        results.failed += employeeAssignments.length;
        const employee = users.find((u) => u.id === employeeId);
        results.errors.push(`Failed for ${employee?.email}: ${error.message}`);
      }
    }

    return results;
  }

  async remove(id: string, companyId: string) {
    console.log(`🗑️ Deleting assignment ${id} for company ${companyId}`);

    const assignment = await this.prisma.reviewerAssignment.findUnique({
      where: { id },
      include: { reviewCycle: true },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (assignment.reviewCycle.companyId !== companyId) {
      throw new NotFoundException('Assignment not found');
    }

    await this.prisma.reviewerAssignment.delete({ where: { id } });

    return { message: 'Assignment deleted successfully' };
  }

  async removeAllForEmployee(
    employeeId: string,
    reviewCycleId: string,
    companyId: string,
  ) {
    console.log(
      `🗑️ Deleting all assignments for employee ${employeeId} in cycle ${reviewCycleId}`,
    );

    await this.validateCycleAccess(reviewCycleId, companyId);
    await this.validateUserInCompany(employeeId, companyId);

    const result = await this.prisma.reviewerAssignment.deleteMany({
      where: { reviewCycleId, employeeId },
    });

    return { message: 'All assignments deleted', count: result.count };
  }

  private async validateCycleAccess(reviewCycleId: string, companyId: string) {
    const cycle = await this.prisma.reviewCycle.findFirst({
      where: { id: reviewCycleId, companyId },
    });

    if (!cycle) {
      throw new NotFoundException('Review cycle not found or access denied');
    }

    return cycle;
  }

  private async validateUserInCompany(userId: string, companyId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId },
    });

    if (!user) {
      throw new BadRequestException('User not found in your company');
    }

    return user;
  }

  private async validateUsersInCompany(userIds: string[], companyId: string) {
    if (userIds.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, companyId },
    });

    if (users.length !== userIds.length) {
      throw new BadRequestException('Some users not found in your company');
    }

    return users;
  }

  private validateAssignments(
    employeeId: string,
    assignments: CreateAssignmentDto[],
  ) {
    // Check for self-assignment
    for (const assignment of assignments) {
      if (assignment.reviewerId === employeeId) {
        throw new BadRequestException('Employee cannot review themselves');
      }
    }

    // Check for duplicate reviewers
    const reviewerMap = new Map<string, Set<string>>();
    for (const assignment of assignments) {
      if (!reviewerMap.has(assignment.reviewerType)) {
        reviewerMap.set(assignment.reviewerType, new Set());
      }
      const reviewers = reviewerMap.get(assignment.reviewerType)!;

      if (reviewers.has(assignment.reviewerId)) {
        throw new BadRequestException(
          `Duplicate ${assignment.reviewerType} assignment for same reviewer`,
        );
      }

      reviewers.add(assignment.reviewerId);
    }
  }
}