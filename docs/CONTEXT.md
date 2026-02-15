# PigWeigh Server - Agent Context

> **Purpose**: This document provides coding agents with the structural context needed to contribute to this Express.js TypeScript server.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js v5
- **Language**: TypeScript
- **ORM**: Prisma v7 (PostgreSQL)
- **Validation**: Zod v4
- **Linting**: ESLint + Prettier
- **Git Hooks**: Husky + lint-staged

---

## Project Structure

```
src/
├── index.ts              # Express app entry point
├── controllers/          # Business logic handlers
│   └── *.controller.ts
├── routes/               # Route definitions
│   └── *.routes.ts
├── middleware/            # Custom middleware
│   └── *.middleware.ts
├── schemas/              # Zod validation schemas
│   └── *.schema.ts
├── services/             # Business logic services
│   └── *.service.ts
└── utils/                # Utility functions
    ├── logger.ts         # Logging utility (USE THIS)
    ├── response.ts       # Standardized API responses (USE THIS)
    └── console-message.ts

prisma/
├── schema.prisma         # Database schema
└── migrations/           # Database migrations

docs/
├── CONTEXT.md            # This file — project conventions
├── FEATURE_INDEX.md      # Navigation hub for all features
├── FEATURE_PROMPT.md     # Reusable prompt for generating feature docs
└── features/             # Per-feature documentation
    └── *.md
```

---

## Folder Responsibilities

### `/controllers`

Controllers contain the business logic for handling requests. They:

- Receive validated request data from routes
- Perform business operations
- Return appropriate responses using `sendSuccess` / `sendSingleError`

**Naming**: `<resource>.controller.ts`

```typescript
// Example: pig.controller.ts
import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { sendSuccess, sendSingleError } from '../utils/response';

export const getPig = async (req: Request, res: Response) => {
  logger.debug('Fetching pig', { id: req.params.id });
  // Business logic here
  sendSuccess(res, { id: req.params.id });
};
```

### `/routes`

Routes define API endpoints and wire up middleware + controllers. They:

- Define HTTP method and path
- Apply relevant middleware (validation, auth, etc.)
- Call controller functions

**Naming**: `<resource>.routes.ts`

```typescript
// Example: pig.routes.ts
import { Router } from 'express';
import { getPig } from '../controllers/pig.controller';
import { validateRequest } from '../middleware/validate.middleware';
import { GetPigSchema } from '../schemas/pig.schema';

const router = Router();

router.get('/:id', validateRequest(GetPigSchema), getPig);

export default router;
```

### `/middleware`

Middleware functions for the request processing pipeline. They:

- Run before controllers
- Can modify req/res objects
- Handle cross-cutting concerns (auth, validation, logging)

**Naming**: `<purpose>.middleware.ts`

```typescript
// Example: auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.debug('Authenticating request');
  // Auth logic here
  next();
};
```

### `/schemas`

Zod schemas for request/response validation. They:

- Define data shapes using Zod v4
- Export TypeScript types inferred from schemas
- Are used by validation middleware

**Naming**: `<resource>.schema.ts`

```typescript
// Example: pig.schema.ts
import { z } from 'zod';

export const CreatePigSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    breed: z.string().optional(),
    birthDate: z.string().datetime().optional(),
  }),
});

export type CreatePigInput = z.infer<typeof CreatePigSchema>['body'];
```

### `/services`

Services encapsulate reusable business logic and database interactions. They:

- Are called by controllers
- Contain Prisma queries and business rules
- Keep controllers thin

**Naming**: `<resource>.service.ts`

```typescript
// Example: pig.service.ts
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export const findPigById = async (id: string) => {
  logger.debug('Finding pig by ID', { id });
  return prisma.pig.findUnique({ where: { id } });
};
```

### `/utils`

Shared utility functions used across the codebase.

| File                | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `logger.ts`         | Structured, colored logging (use this!)    |
| `response.ts`       | Uniform `{ data, errors }` API responses   |
| `console-message.ts`| Dev-friendly request path logging          |

---

## API Response Envelope

**All** API responses MUST use the standard `{ data, errors }` envelope from `src/utils/response.ts`.

### Success Response

```json
{
  "data": { "id": "abc-123", "name": "Babe" },
  "errors": []
}
```

### Error Response

```json
{
  "data": null,
  "errors": [
    { "message": "Pig not found", "field": "id" }
  ]
}
```

### Response Helpers

| Helper             | When to use                                |
| ------------------ | ------------------------------------------ |
| `sendSuccess`      | Successful response with data              |
| `sendError`        | Error response with multiple error objects |
| `sendSingleError`  | Error response with a single message       |

---

## Logging

**Always** use the `logger` singleton from `src/utils/logger.ts` instead of `console.log`.

```typescript
import { logger } from '../utils/logger';

logger.debug('Detailed debug info', { someContext: 'value' });
logger.info('Server started on port 3000');
logger.warn('Deprecated endpoint called');
logger.error('Failed to fetch pig', error);
```

Log level is controlled via the `LOG_LEVEL` environment variable (`DEBUG` | `INFO` | `WARN` | `ERROR`).

---

## Validation Middleware Pattern

Create a generic validation middleware that uses Zod schemas:

```typescript
// src/middleware/validate.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { sendError } from '../utils/response';

export const validateRequest =
  (schema: AnyZodObject) =>
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
```

---

## Key Conventions

1. **Use `logger`** — never raw `console.log` in production code.
2. **Use `sendSuccess` / `sendSingleError`** — every response must follow the `{ data, errors }` envelope.
3. **Validate with Zod** — define schemas in `/schemas`, apply via `validateRequest` middleware.
4. **Controller-Service pattern** — controllers handle HTTP concerns, services handle business logic and database access.
5. **Naming conventions** — files are `kebab-case` or `<resource>.<type>.ts` (e.g., `pig.controller.ts`, `pig.schema.ts`).
6. **One router per resource** — each route file exports a single `Router` instance.
7. **Environment variables** — access via `process.env`, document new ones in `.env.example`.

---

## Development

```bash
# Install dependencies
npm install

# Run in development mode (hot-reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint
npm run lint

# Format
npm run format
```

---

## Adding a New Feature

1. Create the feature doc in `docs/features/<FEATURE>.md`.
2. Add Prisma models to `prisma/schema.prisma` and run `npx prisma migrate dev`.
3. Create files: `<resource>.schema.ts`, `<resource>.service.ts`, `<resource>.controller.ts`, `<resource>.routes.ts`.
4. Register the router in `src/index.ts`.
5. Update `docs/FEATURE_INDEX.md` with a link to the new feature doc.
