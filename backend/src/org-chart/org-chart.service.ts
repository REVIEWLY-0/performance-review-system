import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { IsString, IsOptional, IsInt, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CreateOrgChartNodeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title!: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsInt()
  order?: number;
}

export class UpdateOrgChartNodeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @ValidateIf(o => o.parentId !== null)
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsInt()
  order?: number;
}

@Injectable()
export class OrgChartService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all org chart nodes for a company (flat list — frontend builds tree)
   * CRITICAL: Always filter by companyId for multi-tenancy
   */
  async getAll(companyId: string) {
    return this.prisma.orgChartNode.findMany({
      where: { companyId },
      orderBy: [{ order: 'asc' }, { title: 'asc' }],
      select: { id: true, title: true, parentId: true, order: true },
    });
  }

  /**
   * Create a new org chart node — admin only
   */
  async create(companyId: string, dto: CreateOrgChartNodeDto) {
    if (dto.parentId) {
      const parent = await this.prisma.orgChartNode.findFirst({
        where: { id: dto.parentId, companyId },
      });
      if (!parent) throw new NotFoundException('Parent node not found in your company');
    }
    return this.prisma.orgChartNode.create({
      data: {
        companyId,
        title: dto.title.trim(),
        parentId: dto.parentId ?? null,
        order: dto.order ?? 0,
      },
      select: { id: true, title: true, parentId: true, order: true },
    });
  }

  /**
   * Update an org chart node — admin only
   */
  async update(id: string, companyId: string, dto: UpdateOrgChartNodeDto) {
    const node = await this.prisma.orgChartNode.findFirst({
      where: { id, companyId },
    });
    if (!node) throw new NotFoundException('Node not found');

    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === id) throw new BadRequestException('A node cannot be its own parent');
      const parent = await this.prisma.orgChartNode.findFirst({
        where: { id: dto.parentId, companyId },
      });
      if (!parent) throw new NotFoundException('Parent node not found in your company');

      // Cycle detection: walk up from proposed parent to ensure 'id' is not an ancestor
      let cursor: string | null = dto.parentId;
      const visited = new Set<string>();
      while (cursor) {
        if (cursor === id) throw new BadRequestException('Moving this node would create a cycle');
        if (visited.has(cursor)) break;
        visited.add(cursor);
        const ancestor: { parentId: string | null } | null = await this.prisma.orgChartNode.findFirst({
          where: { id: cursor, companyId },
          select: { parentId: true },
        });
        cursor = ancestor?.parentId ?? null;
      }
    }

    return this.prisma.orgChartNode.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
      select: { id: true, title: true, parentId: true, order: true },
    });
  }

  /**
   * Delete a node (DB cascade removes all descendants)
   */
  async delete(id: string, companyId: string) {
    const node = await this.prisma.orgChartNode.findFirst({
      where: { id, companyId },
    });
    if (!node) throw new NotFoundException('Node not found');
    await this.prisma.orgChartNode.delete({ where: { id } });
    return { success: true };
  }
}
