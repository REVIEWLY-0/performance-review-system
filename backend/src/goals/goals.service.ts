import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CreateGoalDto, UpdateGoalDto, UpsertQuantScoreDto } from './goals.dto';

@Injectable()
export class GoalsService {
  constructor(private prisma: PrismaService) {}

  async listGoals(companyId: string, cycleId: string, employeeId: string) {
    return this.prisma.employeeGoal.findMany({
      where: { companyId, cycleId, employeeId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createGoal(companyId: string, setBy: string, dto: CreateGoalDto) {
    return this.prisma.employeeGoal.create({
      data: {
        companyId,
        cycleId: dto.cycleId,
        employeeId: dto.employeeId,
        title: dto.title,
        description: dto.description,
        rating: dto.rating,
        setBy,
      },
    });
  }

  async updateGoal(companyId: string, goalId: string, dto: UpdateGoalDto) {
    const goal = await this.prisma.employeeGoal.findFirst({
      where: { id: goalId, companyId },
    });
    if (!goal) throw new NotFoundException('Goal not found');

    return this.prisma.employeeGoal.update({
      where: { id: goalId },
      data: {
        ...(dto.title != null ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
      },
    });
  }

  async deleteGoal(companyId: string, goalId: string) {
    const goal = await this.prisma.employeeGoal.findFirst({
      where: { id: goalId, companyId },
    });
    if (!goal) throw new NotFoundException('Goal not found');
    await this.prisma.employeeGoal.delete({ where: { id: goalId } });
    return { message: 'Goal deleted' };
  }

  async upsertQuantScore(companyId: string, setBy: string, dto: UpsertQuantScoreDto) {
    return this.prisma.quantScore.upsert({
      where: { cycleId_employeeId: { cycleId: dto.cycleId, employeeId: dto.employeeId } },
      create: {
        companyId,
        cycleId: dto.cycleId,
        employeeId: dto.employeeId,
        score: dto.score,
        setBy,
        note: dto.note,
      },
      update: {
        score: dto.score,
        setBy,
        note: dto.note,
      },
    });
  }

  async getQuantScore(companyId: string, cycleId: string, employeeId: string) {
    return this.prisma.quantScore.findFirst({
      where: { companyId, cycleId, employeeId },
    });
  }

  /**
   * Returns quantitative score for an employee in a cycle.
   * Priority: average of rated goals → QuantScore fallback → null.
   */
  async getQuantScoreForEmployee(
    companyId: string,
    cycleId: string,
    employeeId: string,
  ): Promise<number | null> {
    const goals = await this.prisma.employeeGoal.findMany({
      where: { companyId, cycleId, employeeId, rating: { not: null } },
      select: { rating: true },
    });

    if (goals.length > 0) {
      const sum = goals.reduce((acc, g) => acc + (g.rating ?? 0), 0);
      return Number((sum / goals.length).toFixed(2));
    }

    const quantScore = await this.prisma.quantScore.findFirst({
      where: { companyId, cycleId, employeeId },
      select: { score: true },
    });

    return quantScore?.score ?? null;
  }
}
