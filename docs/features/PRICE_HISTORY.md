# Feature: Price History Management

> **Status**: ✅ Implemented
> **Depends on**: [TIME_HANDLING](TIME_HANDLING.md), [ADMIN_AUTH](ADMIN_AUTH.md), [SRP_MANAGEMENT](SRP_MANAGEMENT.md)

---

## 1. Overview

Price History Management governs how SRP records transition over time. It enforces the **cascade rule**: when a new SRP record is created with a `startDate`, the previously active record is automatically closed by setting its `endDate` to just before the new record's `startDate`.

This feature also enforces **immutability of past records** — once a price record's effectivity period has begun, it can no longer be edited or deleted. This preserves the integrity of the historical price trail.

### Why It Exists

- The DA publishes new SRPs periodically. Each new price implicitly supersedes the previous one.
- Farmers and traders need a reliable, tamper-proof history of prices to analyze trends.
- The cascade logic automates what would otherwise be a manual, error-prone process of closing old records.

---

## 2. Cascade Rule — The Core Mechanism

### How It Works

When an admin creates a new SRP record with `startDate = T`:

1. **Find the current active record** — the one where `isActive = true` and `endDate IS NULL`.
2. **Close the previous record** — set its `endDate` to `T` (the new record's `startDate`). Also set `isActive = false`.
3. **Create the new record** — with `isActive = true` and `endDate = null`.
4. **All of this happens in a single Prisma transaction** — either everything succeeds or nothing changes.

### Visual Example

**Before** — one active record:

```
Record A: price=₱220  startDate=Jan 1  endDate=null  isActive=true
```

**Admin creates Record B with `startDate = Feb 15`:**

```
Record A: price=₱220  startDate=Jan 1   endDate=Feb 15  isActive=false  ← auto-closed
Record B: price=₱230  startDate=Feb 15  endDate=null    isActive=true   ← new active
```

**Admin creates Record C with `startDate = Mar 1`:**

```
Record A: price=₱220  startDate=Jan 1   endDate=Feb 15  isActive=false
Record B: price=₱230  startDate=Feb 15  endDate=Mar 1   isActive=false  ← auto-closed
Record C: price=₱240  startDate=Mar 1   endDate=null    isActive=true   ← new active
```

### Transaction Implementation

```typescript
// src/services/srp.service.ts
export const createSrpRecord = async (data: CreateSrpInput, adminId: string) => {
  return prisma.$transaction(async (tx) => {
    // 1. Find current active record
    const currentActive = await tx.srpRecord.findFirst({
      where: { isActive: true, endDate: null },
      orderBy: { startDate: 'desc' },
    });

    // 2. Close the previous active record
    if (currentActive) {
      await tx.srpRecord.update({
        where: { id: currentActive.id },
        data: {
          endDate: new Date(data.startDate),
          isActive: false,
        },
      });
    }

    // 3. Create the new record
    const newRecord = await tx.srpRecord.create({
      data: {
        price: data.price,
        reference: data.reference,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        isActive: true,
        createdById: adminId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    return newRecord;
  });
};
```

---

## 3. Immutability Rules

### Past Records Cannot Be Edited or Deleted

A record is considered "past" if its `startDate` is before the current server time (`new Date()`). Once a record's effectivity period has begun, it is **frozen**.

| Operation | Past Record | Future Record (not yet effective) |
|-----------|-------------|-----------------------------------|
| Edit price | ❌ Forbidden | ❌ Forbidden (no edit endpoint) |
| Edit reference | ❌ Forbidden | ❌ Forbidden (no edit endpoint) |
| Edit dates | ❌ Forbidden | ❌ Forbidden (no edit endpoint) |
| Delete | ❌ Forbidden | ❌ Forbidden (no delete endpoint) |
| Auto-close (cascade) | ✅ System-only | N/A |

> **Design Decision**: There are no update or delete endpoints for SRP records at all. The only mutation is the cascade `endDate` set by the system during creation of a new record. This is the simplest way to guarantee immutability and auditability.

### Why No Edit/Delete?

- SRP values come from the DA — they are facts, not opinions. Editing a past price would be falsifying a historical record.
- If a mistake is made, the admin should create a correcting new record (which cascades the old one closed).
- Deletion would create gaps in the price timeline.

---

## 4. API Endpoints (Price History Specific)

These supplement the endpoints defined in [SRP_MANAGEMENT](SRP_MANAGEMENT.md).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/srp` | Public | List all SRP records (history view) |
| `GET` | `/api/srp/active` | Public | Get the current active SRP |
| `GET` | `/api/srp/:id` | Public | Get a specific historical record |

> **Note**: There are intentionally **no** `PUT`, `PATCH`, or `DELETE` endpoints for SRP records.

### Price History List View

The `GET /api/srp` endpoint with default ordering (`startDate DESC`) effectively serves as the price history view. Clients can paginate through it.

**Query additions for history filtering:**

| Param | Type | Description |
|-------|------|-------------|
| `from` | ISO datetime | Filter records with `startDate >= from` |
| `to` | ISO datetime | Filter records with `startDate <= to` |

**Zod Schema Extension:**

```typescript
export const ListSrpQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    isActive: z.coerce.boolean().optional(),
    from: z.iso.datetime().optional(),
    to: z.iso.datetime().optional(),
  }),
});
```

---

## 5. Activation / Deactivation Logic

The `isActive` flag is **entirely server-managed**. It follows these rules:

| Scenario | `isActive` value |
|----------|-----------------|
| New record created, no end date | `true` |
| Record closed by cascade (endDate set) | `false` |
| Record created with an explicit endDate | Depends: `true` if endDate is in the future, `false` if in the past |

### Edge Case: What if there's no active record?

This can happen if:
- The database is empty (fresh install).
- All records have explicit end dates in the past.

The `GET /api/srp/active` endpoint returns 404 in this case.

---

## 6. Implementation Files

| File | Purpose |
|------|---------|
| `src/services/srp.service.ts` | Cascade logic in `createSrpRecord()`, transaction management |
| `src/schemas/srp.schema.ts` | Extended query schema with `from`/`to` filters |
| `src/controllers/srp.controller.ts` | Handles list/filter/get requests |

> No new files are introduced — this feature is business logic layered into the SRP Management implementation.

---

## 7. Business Rules Summary

1. **Cascade on create** — new record auto-closes the previous active record's `endDate`.
2. **Transaction-safe** — cascade and creation happen in a single `$transaction`.
3. **No edit endpoint** — SRP records are append-only.
4. **No delete endpoint** — SRP records are permanent.
5. **`isActive` is server-managed** — clients cannot set it directly.
6. **Price timeline must be continuous** — no gaps between consecutive records (ensured by cascade setting `endDate` to the next record's `startDate`).
7. **Only one active record at a time** — enforced by cascade logic.
8. **Emit after cascade** — the Socket.IO `srp:new` event is emitted only after the transaction commits (see [REALTIME_SRP](REALTIME_SRP.md)).

---

## 8. Data Integrity Constraints

| Constraint | Enforcement |
|------------|-------------|
| Only one `isActive = true` record at a time | Cascade logic (not a DB unique constraint, to allow zero active) |
| `endDate` must be >= `startDate` on same record | Zod validation + service-level check |
| No overlapping effectivity ranges | Cascade logic ensures contiguous, non-overlapping windows |
| `price` > 0 | Zod validation (`z.number().positive()`) |

---

## 9. Testing Notes

- **Cascade basic**: Create Record A (active). Create Record B. Verify A now has `endDate = B.startDate` and `isActive = false`.
- **Cascade chain**: Create A, B, C sequentially. Verify only C is active. Verify A.endDate = B.startDate, B.endDate = C.startDate.
- **Transaction atomicity**: Simulate a failure mid-cascade (e.g., invalid data for new record). Verify the previous record is NOT closed.
- **No active record**: Empty database, call `GET /api/srp/active`, verify 404.
- **History with date filter**: Create records across multiple dates. Use `from` and `to` params. Verify correct filtering.
- **Immutability**: Verify there is no PUT/PATCH/DELETE route returning 200 for SRP records.
- **isActive cannot be set by client**: Send `isActive: false` in POST body, verify it's ignored.
- **Decimal precision in history**: Verify prices across history maintain `Decimal(10,2)` precision.
