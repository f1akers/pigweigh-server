# Feature: Admin Authentication

> **Status**: Planned
> **Depends on**: [TIME_HANDLING](TIME_HANDLING.md)

---

## 1. Overview

Admins are the only user type in PigWeigh Server. They manage SRP records and publications. There is **no self-registration** — admin accounts are inserted directly into the database via Prisma seed scripts.

Authentication uses a simple **username + password** flow that issues a JWT access token. The token is attached to subsequent requests via the `Authorization: Bearer <token>` header.

### Why It Exists

- Only authorized DA personnel should be able to publish or modify SRP records.
- The Flutter app needs a lightweight auth flow to gate admin-only screens.
- No public-facing registration reduces attack surface.

---

## 2. Database Schema

```prisma
model Admin {
  id        String   @id @default(cuid())
  username  String   @unique
  password  String   // bcrypt hash
  name      String   // display name
  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt      @db.Timestamptz
}
```

### Notes

- `username` is unique and used for login.
- `password` stores a **bcrypt hash**, never plaintext.
- No email field — admins are internal, managed via seed.
- No roles or permissions beyond "is admin" — all admins have equal access.

---

## 3. Seeding

Admins are **never** created via API. They are inserted through a Prisma seed script.

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('admin123', 10);

  await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password,
      name: 'Default Admin',
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
```

Configure in `package.json`:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

Run with: `npx prisma db seed`

---

## 4. API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/login` | Public | Authenticate admin, return JWT |
| `GET`  | `/api/auth/me`    | Bearer | Get current admin's profile |

### 4.1 `POST /api/auth/login`

Authenticates an admin with username and password.

**Request Body:**

```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Zod Schema Reference:** `LoginSchema`

```typescript
export const LoginSchema = z.object({
  body: z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
  }),
});
```

**Success Response (200):**

```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "admin": {
      "id": "clx...",
      "username": "admin",
      "name": "Default Admin"
    }
  },
  "errors": []
}
```

**Error Response (401):**

```json
{
  "data": null,
  "errors": [
    { "message": "Invalid username or password" }
  ]
}
```

### 4.2 `GET /api/auth/me`

Returns the authenticated admin's profile. Requires Bearer token.

**Headers:** `Authorization: Bearer <token>`

**Success Response (200):**

```json
{
  "data": {
    "id": "clx...",
    "username": "admin",
    "name": "Default Admin"
  },
  "errors": []
}
```

**Error Response (401):**

```json
{
  "data": null,
  "errors": [
    { "message": "Unauthorized" }
  ]
}
```

---

## 5. Implementation Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | `Admin` model definition |
| `prisma/seed.ts` | Seed script to insert admin accounts |
| `src/schemas/auth.schema.ts` | Zod schemas for login request |
| `src/services/auth.service.ts` | Password verification, JWT generation |
| `src/controllers/auth.controller.ts` | Login and profile handlers |
| `src/routes/auth.routes.ts` | Route definitions (`/api/auth/*`) |
| `src/middleware/auth.middleware.ts` | JWT verification middleware (`authenticate`) |

---

## 6. Business Rules

1. **No registration endpoint** — admins are seeded directly into the database.
2. **Password hashing** — use `bcrypt` with a cost factor of 10.
3. **JWT secret** — stored in `JWT_SECRET` environment variable. Fail loudly at startup if missing.
4. **JWT expiry** — tokens expire after a configurable duration (`JWT_EXPIRES_IN` env var, default `"7d"`).
5. **Token payload** — contains `{ adminId: string }`. Do not include sensitive data.
6. **Password never returned** — all queries must exclude the `password` field from responses.
7. **Generic error message** — login failure always returns `"Invalid username or password"` regardless of whether the username or password was wrong (prevents enumeration).

---

## 7. Auth Middleware

The `authenticate` middleware will be used by all protected routes across the application.

```typescript
// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendSingleError } from '../utils/response';
import { logger } from '../utils/logger';

export interface AuthPayload {
  adminId: string;
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    sendSingleError(res, 'Unauthorized', undefined, 401);
    return;
  }

  const token = header.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    // Attach admin ID to request for downstream use
    (req as any).adminId = payload.adminId;
    next();
  } catch (error) {
    logger.warn('Invalid token presented', { error });
    sendSingleError(res, 'Unauthorized', undefined, 401);
    return;
  }
};
```

---

## 8. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | — | Secret key for signing JWTs. Must be set. |
| `JWT_EXPIRES_IN` | No | `"7d"` | Token expiration duration (e.g., `"1h"`, `"7d"`) |

---

## 9. Dependencies

| Package | Purpose |
|---------|---------|
| `bcrypt` | Password hashing and comparison |
| `jsonwebtoken` | JWT generation and verification |
| `@types/bcrypt` | TypeScript types (devDependency) |
| `@types/jsonwebtoken` | TypeScript types (devDependency) |

---

## 10. Testing Notes

- **Login success**: Seed an admin, login with correct credentials, verify token is returned.
- **Login failure (wrong password)**: Verify 401 with generic message.
- **Login failure (unknown user)**: Verify 401 with the same generic message (no enumeration).
- **`/me` with valid token**: Verify admin profile is returned without `password` field.
- **`/me` without token**: Verify 401.
- **`/me` with expired token**: Verify 401.
- **`/me` with malformed token**: Verify 401.
