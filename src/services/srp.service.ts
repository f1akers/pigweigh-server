import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import { CreateSrpInput, ListSrpQuery } from '../schemas/srp.schema';
import { Prisma } from '@prisma/client';

/**
 * Common select for createdBy relation — never expose password
 */
const createdBySelect = {
  select: { id: true, name: true },
} as const;

/**
 * Create a new SRP record with cascade logic.
 *
 * 1. Find current active record (isActive=true, endDate=null).
 * 2. Close it by setting endDate = new record's startDate, isActive=false.
 * 3. Create the new record with isActive=true.
 * 4. All inside a single transaction.
 */
export const createSrpRecord = async (
  data: CreateSrpInput,
  adminId: string
) => {
  return prisma.$transaction(async (tx) => {
    // 1. Find current active record
    const currentActive = await tx.srpRecord.findFirst({
      where: { isActive: true, endDate: null },
      orderBy: { startDate: 'desc' },
    });

    // 2. Close the previous active record (cascade)
    if (currentActive) {
      await tx.srpRecord.update({
        where: { id: currentActive.id },
        data: {
          endDate: new Date(data.startDate),
          isActive: false,
        },
      });

      logger.info('Cascade: closed previous active SRP record', {
        closedId: currentActive.id,
        newEndDate: data.startDate,
      });
    }

    // 3. Create the new record
    const newRecord = await tx.srpRecord.create({
      data: {
        price: new Prisma.Decimal(data.price),
        reference: data.reference,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        isActive: true,
        createdById: adminId,
      },
      include: {
        createdBy: createdBySelect,
      },
    });

    logger.info('Created new SRP record', { id: newRecord.id });

    return newRecord;
  });
};

/**
 * List SRP records with pagination and optional filters.
 */
export const listSrpRecords = async (query: ListSrpQuery) => {
  const { page, limit, isActive, from, to } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.SrpRecordWhereInput = {};

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (from) {
    where.startDate = {
      ...(typeof where.startDate === 'object' ? where.startDate : {}),
      gte: new Date(from),
    };
  }

  if (to) {
    where.startDate = {
      ...(typeof where.startDate === 'object' ? where.startDate : {}),
      lte: new Date(to),
    };
  }

  const [items, total] = await Promise.all([
    prisma.srpRecord.findMany({
      where,
      orderBy: { startDate: 'desc' },
      skip,
      take: limit,
      include: {
        createdBy: createdBySelect,
      },
    }),
    prisma.srpRecord.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get the currently active SRP record.
 */
export const getActiveSrpRecord = async () => {
  return prisma.srpRecord.findFirst({
    where: { isActive: true, endDate: null },
    orderBy: { startDate: 'desc' },
    include: {
      createdBy: createdBySelect,
    },
  });
};

/**
 * Get a single SRP record by ID.
 */
export const getSrpRecordById = async (id: string) => {
  return prisma.srpRecord.findUnique({
    where: { id },
    include: {
      createdBy: createdBySelect,
    },
  });
};
