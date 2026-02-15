import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendSingleError } from '../utils/response';
import { logger } from '../utils/logger';

export interface AuthPayload {
  adminId: string;
}

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    sendSingleError(res, 'Unauthorized', 401);
    return;
  }

  const token = header.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    // Attach admin ID to request for downstream use
    (req as Request & { adminId: string }).adminId = payload.adminId;
    next();
  } catch (error) {
    logger.warn('Invalid token presented', { error });
    sendSingleError(res, 'Unauthorized', 401);
    return;
  }
};
