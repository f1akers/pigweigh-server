import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import {
  createSrpRecord,
  listSrpRecords,
  getActiveSrpRecord,
  getSrpRecordById,
} from '../services/srp.service';
import { getIO } from '../socket';

/**
 * POST /api/srp — Create a new SRP record (with cascade)
 */
export const createSrp = async (req: Request, res: Response) => {
  const adminId = (req as Request & { adminId: string }).adminId;
  const { price, reference, startDate, endDate } = req.body;

  logger.debug('Creating SRP record', { adminId, price, startDate });

  try {
    const record = await createSrpRecord(
      { price, reference, startDate, endDate },
      adminId
    );

    // Broadcast to all connected clients — only after transaction commits
    getIO().emit('srp:new', record);
    logger.info('Broadcast srp:new event', { id: record.id });

    sendSuccess(res, record, 201);
  } catch (error) {
    logger.error('Failed to create SRP record', error);
    sendSingleError(res, 'Failed to create SRP record', 500);
  }
};

/**
 * GET /api/srp — List SRP records (paginated, filterable)
 */
export const listSrp = async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const isActive =
    req.query.isActive === 'true'
      ? true
      : req.query.isActive === 'false'
        ? false
        : undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  try {
    const result = await listSrpRecords({ page, limit, isActive, from, to });
    sendSuccess(res, result);
  } catch (error) {
    logger.error('Failed to list SRP records', error);
    sendSingleError(res, 'Failed to list SRP records', 500);
  }
};

/**
 * GET /api/srp/active — Get the currently active SRP record
 */
export const getActiveSrp = async (_req: Request, res: Response) => {
  try {
    const record = await getActiveSrpRecord();

    if (!record) {
      sendSingleError(res, 'No active SRP record found', 404);
      return;
    }

    sendSuccess(res, record);
  } catch (error) {
    logger.error('Failed to get active SRP record', error);
    sendSingleError(res, 'Failed to get active SRP record', 500);
  }
};

/**
 * GET /api/srp/:id — Get a single SRP record by ID
 */
export const getSrpById = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    const record = await getSrpRecordById(id);

    if (!record) {
      sendSingleError(res, 'SRP record not found', 404, 'id');
      return;
    }

    sendSuccess(res, record);
  } catch (error) {
    logger.error('Failed to get SRP record', error);
    sendSingleError(res, 'Failed to get SRP record', 500);
  }
};
