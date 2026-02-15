import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodType } from 'zod';
import { sendError } from '../utils/response';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const validateRequest =
  (schema: ZodType<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        sendError(res, errors, 422);
        return;
      }
      next(error);
    }
  };
