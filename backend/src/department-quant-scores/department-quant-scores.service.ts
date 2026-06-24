import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class UpsertDepartmentQuantScoreDto {
  @IsString()
  cycleId!: string;

  @IsString()
  departmentId!: string;

  @IsNumber()
  @Min(0)
  @Max(5)
  score!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

@Injectable()
export class DepartmentQuantScoresService {
  constructor(private prisma: PrismaService) {}

  /** List all department quant scores for a cycle (admin view). */
  async findByCycle(cycleId: string, companyId: string) {
    await this.validateCycleAccess(cycleId, companyId);

    const [scores, departments] = await Promise.all([
      this.prisma.departmentQuantScore.findMany({
        where: { cycleId, companyId },
        include: {
          department: { select: { id: true, name: true } },
          setter: { select: { id: true, name: true } },
        },
        orderBy: { department: { name: 'asc' } },
      }),
      this.prisma.department.findMany({
        where: { companyId, archivedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const scoreByDept = new Map(scores.map((s) => [s.departmentId, s]));

    return departments.map((dept) => {
      const existing = scoreByDept.get(dept.id);
      return {
        department: { id: dept.id, name: dept.name },
        score: existing?.score ?? null,
        note: existing?.note ?? null,
        setBy: existing?.setter ?? null,
        updatedAt: existing?.updatedAt ?? null,
      };
    });
  }

  /** Upsert a department quant score (one per dept per cycle). */
  async upsert(dto: UpsertDepartmentQuantScoreDto, companyId: string, setBy: string) {
    await this.validateCycleAccess(dto.cycleId, companyId);
    await this.validateDepartmentAccess(dto.departmentId, companyId);

    return this.prisma.departmentQuantScore.upsert({
      where: {
        cycleId_departmentId: {
          cycleId: dto.cycleId,
          departmentId: dto.departmentId,
        },
      },
      create: {
        companyId,
        cycleId: dto.cycleId,
        departmentId: dto.departmentId,
        score: dto.score,
        note: dto.note ?? null,
        setBy,
      },
      update: {
        score: dto.score,
        note: dto.note ?? null,
        setBy,
      },
      include: {
        department: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Compute an employee's quant score as the mean of their departments' scores.
   * Called by ScoringService — not an HTTP endpoint.
   * Returns null if the employee has no departments or no scores are set.
   */
  async getEmployeeQuantScore(
    companyId: string,
    cycleId: string,
    employeeId: string,
  ): Promise<number | null> {
    const userDepts = await this.prisma.userDepartment.findMany({
      where: { userId: employeeId },
      select: { departmentId: true },
    });

    if (userDepts.length === 0) return null;

    const deptIds = userDepts.map((ud) => ud.departmentId);

    const scores = await this.prisma.departmentQuantScore.findMany({
      where: { companyId, cycleId, departmentId: { in: deptIds } },
      select: { score: true },
    });

    if (scores.length === 0) return null;

    const mean = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
    return Number(mean.toFixed(2));
  }

  /**
   * Bulk version for calculateAllScores — avoids N+1 by doing two queries upfront.
   * Returns a Map<employeeId, quantScore | null>.
   */
  async buildEmployeeQuantMap(
    companyId: string,
    cycleId: string,
    employeeIds: string[],
  ): Promise<Map<string, number | null>> {
    if (employeeIds.length === 0) return new Map();

    const [allUserDepts, allDeptScores] = await Promise.all([
      this.prisma.userDepartment.findMany({
        where: { userId: { in: employeeIds } },
        select: { userId: true, departmentId: true },
      }),
      this.prisma.departmentQuantScore.findMany({
        where: { companyId, cycleId },
        select: { departmentId: true, score: true },
      }),
    ]);

    const deptScoreMap = new Map(allDeptScores.map((ds) => [ds.departmentId, ds.score]));

    // Group dept memberships by employee
    const deptsByEmployee = new Map<string, string[]>();
    for (const ud of allUserDepts) {
      const list = deptsByEmployee.get(ud.userId) ?? [];
      list.push(ud.departmentId);
      deptsByEmployee.set(ud.userId, list);
    }

    const result = new Map<string, number | null>();
    for (const empId of employeeIds) {
      const depts = deptsByEmployee.get(empId) ?? [];
      const scores = depts
        .map((dId) => deptScoreMap.get(dId))
        .filter((s): s is number => s !== undefined);

      if (scores.length === 0) {
        result.set(empId, null);
      } else {
        const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        result.set(empId, Number(mean.toFixed(2)));
      }
    }

    return result;
  }

  private async validateCycleAccess(cycleId: string, companyId: string) {
    const cycle = await this.prisma.reviewCycle.findFirst({
      where: { id: cycleId, companyId },
    });
    if (!cycle) throw new NotFoundException('Review cycle not found or access denied');
    return cycle;
  }

  private async validateDepartmentAccess(departmentId: string, companyId: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id: departmentId, companyId, archivedAt: null },
    });
    if (!dept) throw new NotFoundException('Department not found or access denied');
    return dept;
  }
}
