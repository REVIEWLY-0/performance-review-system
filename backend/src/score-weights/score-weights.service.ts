import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { UpdateScoreWeightsDto } from './score-weights.dto';

const DEFAULTS = {
  quantWeight: 50,
  managerWeight: 60,
  peerWeight: 30,
  selfWeight: 10,
  minPeerThreshold: 3,
};

@Injectable()
export class ScoreWeightsService {
  constructor(private prisma: PrismaService) {}

  async getOrCreate(companyId: string) {
    const existing = await this.prisma.scoreWeightConfig.findUnique({
      where: { companyId },
    });
    if (existing) return existing;

    return this.prisma.scoreWeightConfig.create({
      data: { companyId, ...DEFAULTS },
    });
  }

  async update(companyId: string, dto: UpdateScoreWeightsDto) {
    const qualWeight = 100 - dto.quantWeight;
    if (qualWeight < 0 || dto.quantWeight > 100) {
      throw new BadRequestException('quantWeight must be 0–100');
    }

    const qualSum = dto.managerWeight + dto.peerWeight + dto.selfWeight;
    if (qualSum !== 100) {
      throw new BadRequestException(
        `managerWeight + peerWeight + selfWeight must equal 100, got ${qualSum}`,
      );
    }

    await this.getOrCreate(companyId);

    return this.prisma.scoreWeightConfig.update({
      where: { companyId },
      data: {
        quantWeight: dto.quantWeight,
        managerWeight: dto.managerWeight,
        peerWeight: dto.peerWeight,
        selfWeight: dto.selfWeight,
        ...(dto.minPeerThreshold != null ? { minPeerThreshold: dto.minPeerThreshold } : {}),
      },
    });
  }
}
