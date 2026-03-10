import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;
}

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  /** List active (non-archived) departments for a company */
  async findAll(companyId: string) {
    return this.prisma.department.findMany({
      where: { companyId, archivedAt: null },
      include: {
        _count: { select: { userDepts: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  /** List archived departments for a company */
  async findArchived(companyId: string) {
    return this.prisma.department.findMany({
      where: { companyId, archivedAt: { not: null } },
      include: {
        _count: { select: { userDepts: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  /** Create a new department (or restore if previously archived) */
  async create(companyId: string, dto: CreateDepartmentDto) {
    const name = dto.name.trim();

    const existing = await this.prisma.department.findFirst({
      where: { companyId, name },
    });

    if (existing) {
      if (existing.archivedAt) {
        // Restore archived department
        return this.prisma.department.update({
          where: { id: existing.id },
          data: { archivedAt: null },
          include: { _count: { select: { userDepts: true } } },
        });
      }
      throw new ConflictException(`Department "${name}" already exists`);
    }

    return this.prisma.department.create({
      data: { companyId, name },
      include: { _count: { select: { userDepts: true } } },
    });
  }

  /** Rename a department */
  async update(id: string, companyId: string, dto: UpdateDepartmentDto) {
    const dept = await this.prisma.department.findFirst({
      where: { id, companyId },
    });
    if (!dept) throw new NotFoundException('Department not found');

    if (dto.name) {
      const name = dto.name.trim();
      const conflict = await this.prisma.department.findFirst({
        where: { companyId, name, id: { not: id } },
      });
      if (conflict) {
        throw new ConflictException(`Department "${name}" already exists`);
      }
      return this.prisma.department.update({
        where: { id },
        data: { name },
        include: { _count: { select: { userDepts: true } } },
      });
    }

    return dept;
  }

  /** Archive a department (soft delete) */
  async archive(id: string, companyId: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id, companyId },
    });
    if (!dept) throw new NotFoundException('Department not found');

    return this.prisma.department.update({
      where: { id },
      data: { archivedAt: new Date() },
      include: { _count: { select: { userDepts: true } } },
    });
  }

  /** Restore an archived department */
  async restore(id: string, companyId: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id, companyId },
    });
    if (!dept) throw new NotFoundException('Department not found');

    return this.prisma.department.update({
      where: { id },
      data: { archivedAt: null },
      include: { _count: { select: { userDepts: true } } },
    });
  }
}
