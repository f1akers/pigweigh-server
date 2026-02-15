# Feature: Time Handling

> **Status**: Planned
> **Priority**: Foundation (must be implemented before all other features)

---

## 1. Overview

PigWeigh Server is **time-zone agnostic**. Every timestamp persisted or returned by the API is stored in UTC **with timezone metadata** (`timestamptz` in PostgreSQL). The server never assumes a local timezone — all timezone conversion is the **client's responsibility**.

This is a cross-cutting architectural convention, not a single endpoint. It governs how every feature handles dates and date ranges.

### Why This Exists

- The Philippine DA's SRP effectivity dates must be unambiguous regardless of where the server or client runs.
- Price history comparisons and real-time publication ordering depend on consistent, comparable timestamps.
- The Flutter mobile app will convert UTC timestamps to the user's local timezone (typically `Asia/Manila` / UTC+8) for display.

---

## 2. Conventions

### 2.1 Prisma Schema

**Every** `DateTime` field in the Prisma schema **must** use the `@db.Timestamptz` annotation to ensure PostgreSQL stores it as `timestamp with time zone`.

```prisma
model Example {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt      @db.Timestamptz
  startDate DateTime                 @db.Timestamptz
  endDate   DateTime?                @db.Timestamptz
}
```

> **Rule**: If you add a `DateTime` field and forget `@db.Timestamptz`, treat it as a bug.

### 2.2 API Input (Request)

- Clients **must** send dates as **ISO 8601 strings** with a timezone offset or the `Z` (UTC) suffix.
- Valid examples:
  - `"2026-02-15T00:00:00Z"` (UTC)
  - `"2026-02-15T08:00:00+08:00"` (PHT, equivalent to midnight UTC+8)
- The server will parse and store whatever the client sends, normalized to UTC internally by PostgreSQL.

Zod validation schemas should use `z.iso.datetime()` (Zod v4's ISO datetime validator) to ensure incoming strings are valid ISO 8601 datetime values:

```typescript
import { z } from 'zod';

export const DateFieldSchema = z.iso.datetime(); // Validates ISO 8601 datetime strings
```

### 2.3 API Output (Response)

- All timestamps returned in JSON responses are **ISO 8601 UTC strings** (e.g., `"2026-02-15T00:00:00.000Z"`).
- Prisma's default serialization already does this — no extra transformation is needed.
- The client (Flutter app) is responsible for converting to local display time.

### 2.4 Date-Range Queries

When filtering by date ranges (e.g., "prices effective on a given date"):

- Use **inclusive start** and **exclusive end** (`>=` start, `<` end) unless the business rule explicitly states otherwise.
- Always compare using full timestamps, not date-only strings.

```typescript
// Example: Find the active price on a given date
const activePrice = await prisma.srpRecord.findFirst({
  where: {
    startDate: { lte: queryDate },
    OR: [
      { endDate: null },
      { endDate: { gt: queryDate } },
    ],
  },
  orderBy: { startDate: 'desc' },
});
```

### 2.5 Prisma Base Fields

Every model should include the standard audit timestamps:

```prisma
createdAt DateTime @default(now()) @db.Timestamptz
updatedAt DateTime @updatedAt      @db.Timestamptz
```

These are auto-managed by Prisma and require no manual intervention.

---

## 3. Implementation Checklist

| # | Task | Notes |
|---|------|-------|
| 1 | Audit every `DateTime` in `schema.prisma` | Add `@db.Timestamptz` to all |
| 2 | Use `z.iso.datetime()` for date input validation | In all Zod schemas |
| 3 | Never call `new Date()` for business logic timestamps | Accept from client or use `@default(now())` |
| 4 | Document in `.env.example` that `TZ` env var should **not** be set | Prevent accidental server-level TZ override |
| 5 | Ensure PostgreSQL connection timezone is UTC | Default behavior; do not override |

---

## 4. Anti-Patterns (Do NOT Do)

| Anti-Pattern | Why It's Wrong |
|---|---|
| Using `@db.Timestamp` (without `tz`) | Strips timezone info; ambiguous at query time |
| Storing date-only strings (`"2026-02-15"`) | No timezone context; comparison bugs across time zones |
| Server-side `new Date().toLocaleDateString()` | Couples server to its OS timezone |
| Returning pre-formatted date strings (e.g., `"Feb 15, 2026"`) | Client cannot re-localize |
| Comparing dates as strings without parsing | Lexicographic ordering breaks across formats |

---

## 5. Client Contract

| Responsibility | Owner |
|---|---|
| Send ISO 8601 datetime with offset or `Z` | Client (Flutter app) |
| Store as `timestamptz` in UTC | Server (Prisma + PostgreSQL) |
| Return ISO 8601 UTC in JSON responses | Server |
| Convert UTC to user's local timezone for display | Client (Flutter app) |

---

## 6. Testing Notes

- Seed test data with explicit UTC timestamps.
- Write tests that create records with `+08:00` offset and verify they're stored/returned as UTC.
- Test date-range boundaries: ensure records at exact boundary timestamps are included/excluded correctly.
- Verify that the health-check timestamp (`/health`) returns a `Z`-suffixed ISO string.
