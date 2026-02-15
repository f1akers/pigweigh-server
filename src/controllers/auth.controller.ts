import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';
import { loginAdmin, findAdminById } from '../services/auth.service';

/**
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  logger.debug('Login attempt', { username });

  const result = await loginAdmin({ username, password });

  if (!result) {
    sendSingleError(res, 'Invalid username or password', 401);
    return;
  }

  logger.info('Admin logged in', { adminId: result.admin.id });
  sendSuccess(res, result);
};

/**
 * GET /api/auth/me
 */
export const me = async (req: Request, res: Response) => {
  const adminId = (req as Request & { adminId: string }).adminId;
  const admin = await findAdminById(adminId);

  if (!admin) {
    sendSingleError(res, 'Unauthorized', 401);
    return;
  }

  sendSuccess(res, admin);
};
