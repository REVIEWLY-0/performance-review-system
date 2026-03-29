import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ReviewCyclesService } from './review-cycles.service';
import { PrismaService } from '../common/services/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

// ─── Shared mock factories ────────────────────────────────────────────────────

const COMPANY_ID = 'company-1';
const CYCLE_ID   = 'cycle-1';

function draftCycle(overrides: Record<string, any> = {}) {
  return {
    id: CYCLE_ID,
    companyId: COMPANY_ID,
    name: 'Q1 2026',
    status: 'DRAFT',
    startDate: new Date('2026-01-01'),
    endDate:   new Date('2026-03-31'),
    reviewConfigs: [{ id: 'cfg-1', stepNumber: 1 }],
    ...overrides,
  };
}

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    reviewCycle: {
      // activate() calls findFirst twice: once in findOne(), once in validateNoOverlap()
      // Return the cycle on the first call, null on the second (no overlap)
      findFirst: jest.fn()
        .mockResolvedValueOnce(draftCycle())
        .mockResolvedValueOnce(null),
      findMany:  jest.fn().mockResolvedValue([]),
      update:    jest.fn().mockResolvedValue(draftCycle({ status: 'ACTIVE' })),
      ...overrides.reviewCycle,
    },
    question: {
      count: jest.fn().mockResolvedValue(3), // 3 questions by default
      ...overrides.question,
    },
    reviewConfig: {
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.reviewConfig,
    },
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

async function createService(prismaOverrides: Record<string, any> = {}) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ReviewCyclesService,
      { provide: PrismaService,       useValue: makePrisma(prismaOverrides) },
      { provide: NotificationsService, useValue: { sendCycleStartedNotifications: jest.fn().mockResolvedValue(undefined) } },
    ],
  }).compile();

  return {
    service: module.get<ReviewCyclesService>(ReviewCyclesService),
    prisma:  module.get<PrismaService>(PrismaService) as jest.Mocked<PrismaService>,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReviewCyclesService — activate()', () => {

  it('throws BadRequestException when cycle is already ACTIVE', async () => {
    // Guard fires before validateNoOverlap — only one findFirst call needed
    const { service } = await createService({
      reviewCycle: { findFirst: jest.fn().mockResolvedValue(draftCycle({ status: 'ACTIVE' })) },
    });

    await expect(service.activate(CYCLE_ID, COMPANY_ID))
      .rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when cycle is COMPLETED', async () => {
    const { service } = await createService({
      reviewCycle: { findFirst: jest.fn().mockResolvedValue(draftCycle({ status: 'COMPLETED' })) },
    });

    await expect(service.activate(CYCLE_ID, COMPANY_ID))
      .rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when cycle has no workflow steps', async () => {
    // Guard fires after validateNoOverlap — need two findFirst calls
    const { service } = await createService({
      reviewCycle: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(draftCycle({ reviewConfigs: [] })) // findOne
          .mockResolvedValueOnce(null),                              // validateNoOverlap
        findMany: jest.fn().mockResolvedValue([]),
      },
    });

    await expect(service.activate(CYCLE_ID, COMPANY_ID))
      .rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when no questions have been configured', async () => {
    const { service } = await createService({
      question: { count: jest.fn().mockResolvedValue(0) },
    });

    await expect(service.activate(CYCLE_ID, COMPANY_ID))
      .rejects.toThrow(BadRequestException);
  });

  it('activates successfully when all preconditions are met', async () => {
    const { service } = await createService();

    const result = await service.activate(CYCLE_ID, COMPANY_ID);

    expect(result.status).toBe('ACTIVE');
  });

  it('sends cycle started notifications after activation', async () => {
    const sendNotif = jest.fn().mockResolvedValue(undefined);
    const prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewCyclesService,
        { provide: PrismaService,        useValue: prisma },
        { provide: NotificationsService, useValue: { sendCycleStartedNotifications: sendNotif } },
      ],
    }).compile();

    const service = module.get<ReviewCyclesService>(ReviewCyclesService);
    await service.activate(CYCLE_ID, COMPANY_ID);

    expect(sendNotif).toHaveBeenCalledWith(CYCLE_ID, COMPANY_ID);
  });
});

describe('ReviewCyclesService — complete()', () => {

  it('throws BadRequestException when cycle is not ACTIVE', async () => {
    const { service } = await createService({
      reviewCycle: { findFirst: jest.fn().mockResolvedValue(draftCycle({ status: 'DRAFT' })) },
    });

    await expect(service.complete(CYCLE_ID, COMPANY_ID))
      .rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when cycle is already COMPLETED', async () => {
    const { service } = await createService({
      reviewCycle: { findFirst: jest.fn().mockResolvedValue(draftCycle({ status: 'COMPLETED' })) },
    });

    await expect(service.complete(CYCLE_ID, COMPANY_ID))
      .rejects.toThrow(BadRequestException);
  });
});
