import { z } from 'zod';

// ---------------------------------------------------------------------------
// POST /api/srp  — Create SRP Record
// ---------------------------------------------------------------------------
export const CreateSrpSchema = z.object({
  body: z.object({
    price: z.number().positive('Price must be a positive number'),
    reference: z.string().min(1, 'Reference is required'),
    startDate: z.iso.datetime({
      message: 'startDate must be a valid ISO 8601 datetime',
    }),
    endDate: z.iso
      .datetime({
        message: 'endDate must be a valid ISO 8601 datetime',
      })
      .optional(),
  }),
});

export type CreateSrpInput = z.infer<typeof CreateSrpSchema>['body'];

// ---------------------------------------------------------------------------
// GET /api/srp  — List SRP Records
// ---------------------------------------------------------------------------
export const ListSrpQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    isActive: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    from: z.iso.datetime().optional(),
    to: z.iso.datetime().optional(),
  }),
});

export type ListSrpQuery = z.infer<typeof ListSrpQuerySchema>['query'];

// ---------------------------------------------------------------------------
// GET /api/srp/:id  — Get SRP by ID
// ---------------------------------------------------------------------------
export const GetSrpParamsSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'ID is required'),
  }),
});

export type GetSrpParams = z.infer<typeof GetSrpParamsSchema>['params'];
