import { BadRequestException } from '@nestjs/common';
import { ScoreWeightsService } from './score-weights.service';
import { PrismaService } from '../common/services/prisma.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const COMPANY_ID = 'co-1';

const DEFAULT_CONFIG = {
  id: 'cfg-1',
  companyId: COMPANY_ID,
  quantWeight: 50,
  managerWeight: 60,
  peerWeight: 30,
  selfWeight: 10,
  minPeerThreshold: 3,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Service factory ──────────────────────────────────────────────────────────

function makeService(overrides: Partial<Record<string, any>> = {}): ScoreWeightsService {
  const prisma = {
    scoreWeightConfig: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    ...overrides,
  } as unknown as PrismaService;
  return new ScoreWeightsService(prisma);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ScoreWeightsService', () => {
  describe('getOrCreate', () => {
    it('returns existing config when found', async () => {
      const svc = makeService();
      (svc as any).prisma.scoreWeightConfig.findUnique.mockResolvedValue(DEFAULT_CONFIG);

      const result = await svc.getOrCreate(COMPANY_ID);

      expect(result).toEqual(DEFAULT_CONFIG);
      expect((svc as any).prisma.scoreWeightConfig.create).not.toHaveBeenCalled();
    });

    it('creates config with defaults when none exists', async () => {
      const svc = makeService();
      (svc as any).prisma.scoreWeightConfig.findUnique.mockResolvedValue(null);
      (svc as any).prisma.scoreWeightConfig.create.mockResolvedValue(DEFAULT_CONFIG);

      const result = await svc.getOrCreate(COMPANY_ID);

      expect((svc as any).prisma.scoreWeightConfig.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: COMPANY_ID,
          quantWeight: 50,
          managerWeight: 60,
          peerWeight: 30,
          selfWeight: 10,
          minPeerThreshold: 3,
        }),
      });
      expect(result).toEqual(DEFAULT_CONFIG);
    });
  });

  describe('update — validation', () => {
    it('rejects when qual weights do not sum to 100', async () => {
      const svc = makeService();
      (svc as any).prisma.scoreWeightConfig.findUnique.mockResolvedValue(DEFAULT_CONFIG);

      await expect(
        svc.update(COMPANY_ID, {
          quantWeight: 50,
          managerWeight: 50,
          peerWeight: 30,
          selfWeight: 10,  // 50+30+10 = 90 ≠ 100
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when quantWeight is out of range (> 100)', async () => {
      const svc = makeService();
      (svc as any).prisma.scoreWeightConfig.findUnique.mockResolvedValue(DEFAULT_CONFIG);

      await expect(
        svc.update(COMPANY_ID, {
          quantWeight: 110,
          managerWeight: 60,
          peerWeight: 30,
          selfWeight: 10,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts valid weights and persists them', async () => {
      const svc = makeService();
      (svc as any).prisma.scoreWeightConfig.findUnique.mockResolvedValue(DEFAULT_CONFIG);
      const updated = { ...DEFAULT_CONFIG, managerWeight: 50, peerWeight: 40, selfWeight: 10, quantWeight: 30 };
      (svc as any).prisma.scoreWeightConfig.update.mockResolvedValue(updated);

      const result = await svc.update(COMPANY_ID, {
        quantWeight: 30,
        managerWeight: 50,
        peerWeight: 40,
        selfWeight: 10,  // 50+40+10 = 100 ✓
      });

      expect((svc as any).prisma.scoreWeightConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: COMPANY_ID },
          data: expect.objectContaining({
            quantWeight: 30,
            managerWeight: 50,
            peerWeight: 40,
            selfWeight: 10,
          }),
        }),
      );
      expect(result).toEqual(updated);
    });

    it('accepts quantWeight=0 (qual-only mode)', async () => {
      const svc = makeService();
      (svc as any).prisma.scoreWeightConfig.findUnique.mockResolvedValue(DEFAULT_CONFIG);
      (svc as any).prisma.scoreWeightConfig.update.mockResolvedValue(DEFAULT_CONFIG);

      await expect(
        svc.update(COMPANY_ID, {
          quantWeight: 0,
          managerWeight: 60,
          peerWeight: 30,
          selfWeight: 10,
        }),
      ).resolves.not.toThrow();
    });

    it('accepts quantWeight=100 (quant-only mode)', async () => {
      const svc = makeService();
      (svc as any).prisma.scoreWeightConfig.findUnique.mockResolvedValue(DEFAULT_CONFIG);
      (svc as any).prisma.scoreWeightConfig.update.mockResolvedValue(DEFAULT_CONFIG);

      // qualWeight = 0, so qual weights can be anything summing to 100
      await expect(
        svc.update(COMPANY_ID, {
          quantWeight: 100,
          managerWeight: 60,
          peerWeight: 30,
          selfWeight: 10,
        }),
      ).resolves.not.toThrow();
    });

    it('persists optional minPeerThreshold when provided', async () => {
      const svc = makeService();
      (svc as any).prisma.scoreWeightConfig.findUnique.mockResolvedValue(DEFAULT_CONFIG);
      (svc as any).prisma.scoreWeightConfig.update.mockResolvedValue(DEFAULT_CONFIG);

      await svc.update(COMPANY_ID, {
        quantWeight: 50,
        managerWeight: 60,
        peerWeight: 30,
        selfWeight: 10,
        minPeerThreshold: 5,
      });

      expect((svc as any).prisma.scoreWeightConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ minPeerThreshold: 5 }),
        }),
      );
    });
  });
});
