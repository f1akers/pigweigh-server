# Feature: SRP Management

> **Status**: Planned
> **Depends on**: [TIME_HANDLING](TIME_HANDLING.md), [ADMIN_AUTH](ADMIN_AUTH.md)

---

## 1. Overview

Admins can encode the **official Suggested Retail Price (SRP)** for pork/pig products as published by the Philippine Department of Agriculture (DA). Each SRP record captures:

- A **price** in PHP (Philippine Peso)
- A **reference** string (typically a URL to the DA publication or memorandum)
- A **start date** for effectivity
- An optional **end date** for effectivity

This is the core data management feature of the server. SRP records feed the real-time publication system and the price history view.

### Why It Exists

- The DA periodically publishes new SRP values. PigWeigh needs a structured, queryable store of these prices.
- Pig farmers and traders using the Flutter app need to see the current and historical SRPs to make informed decisions.
- Having an audit trail of prices with effectivity windows enables price history analysis.

---

## 2. Database Schema

```prisma
model SrpRecord {
  id          String    @id @default(cuid())
  price       Decimal   @db.Decimal(10, 2)  // PHP value, e.g., 230.00
  reference   String                         // URL or text reference to DA publication
  startDate   DateTime  @db.Timestamptz      // Effectivity start date
  endDate     DateTime? @db.Timestamptz      // Effectivity end date (null = currently active)
  isActive    Boolean   @default(true)       // Computed convenience flag
  createdById String
  createdBy   Admin     @relation(fields: [createdById], references: [id])
  createdAt   DateTime  @default(now()) @db.Timestamptz
  updatedAt   DateTime  @updatedAt      @db.Timestamptz
}
```

### Relationships

- `SrpRecord.createdById` → `Admin.id` — tracks which admin encoded the record.
- Add to `Admin` model: `srpRecords SrpRecord[]`

### Field Notes

| Field | Type | Description |
|-------|------|-------------|
| `price` | `Decimal(10,2)` | PHP currency value. Use `Decimal` for monetary precision, never `Float`. |
| `reference` | `String` | Free-text, typically a URL to the DA memorandum/circular. |
| `startDate` | `DateTime @db.Timestamptz` | When this price takes effect. |
| `endDate` | `DateTime? @db.Timestamptz` | When this price stops being effective. `null` means currently active. |
| `isActive` | `Boolean` | `true` if the record is the current effective price. Managed by business logic. |
| `createdById` | `String` | FK to the admin who created this record. |

---

## 3. API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST`   | `/api/srp`          | Bearer | Create a new SRP record |
| `GET`    | `/api/srp`          | Public | List SRP records (with filters) |
| `GET`    | `/api/srp/active`   | Public | Get the currently active SRP record |
| `GET`    | `/api/srp/:id`      | Public | Get a single SRP record by ID |

### 3.1 `POST /api/srp` — Create SRP Record

Creates a new SRP record. **This is the primary write operation.** When a new record is created with a `startDate`, the system automatically closes the previous active record's `endDate` (see [PRICE_HISTORY](PRICE_HISTORY.md) for the cascade logic).

**Auth**: Required (Bearer token)

**Request Body:**

```json
{
  "price": 230.00,
  "reference": "https://www.da.gov.ph/srp-memo-2026-001",
  "startDate": "2026-02-15T00:00:00+08:00"
}
```

**Zod Schema Reference:** `CreateSrpSchema`

```typescript
export const CreateSrpSchema = z.object({
  body: z.object({
    price: z.number().positive('Price must be a positive number'),
    reference: z.string().min(1, 'Reference is required'),
    startDate: z.iso.datetime({ message: 'startDate must be a valid ISO 8601 datetime' }),
    endDate: z.iso.datetime({ message: 'endDate must be a valid ISO 8601 datetime' }).optional(),
  }),
});
```

**Success Response (201):**

```json
{
  "data": {
    "id": "clx...",
    "price": "230.00",
    "reference": "https://www.da.gov.ph/srp-memo-2026-001",
    "startDate": "2026-02-14T16:00:00.000Z",
    "endDate": null,
    "isActive": true,
    "createdBy": {
      "id": "clx...",
      "name": "Default Admin"
    },
    "createdAt": "2026-02-15T00:00:00.000Z",
    "updatedAt": "2026-02-15T00:00:00.000Z"
  },
  "errors": []
}
```

**Error Responses:**

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid token |
| 422 | Validation error (Zod) |
| 409 | `startDate` conflicts with an existing record's range |

### 3.2 `GET /api/srp` — List SRP Records

Returns a paginated list of SRP records, ordered by `startDate` descending (newest first).

**Auth**: Public (no token required — the Flutter app reads this for display)

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Records per page |
| `isActive` | boolean | — | Filter by active status |

**Zod Schema Reference:** `ListSrpQuerySchema`

```typescript
export const ListSrpQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    isActive: z.coerce.boolean().optional(),
  }),
});
```

**Success Response (200):**

```json
{
  "data": {
    "items": [
      {
        "id": "clx...",
        "price": "230.00",
        "reference": "https://...",
        "startDate": "2026-02-14T16:00:00.000Z",
        "endDate": null,
        "isActive": true,
        "createdBy": { "id": "clx...", "name": "Default Admin" },
        "createdAt": "2026-02-15T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  },
  "errors": []
}
```

### 3.3 `GET /api/srp/active` — Get Active SRP

Returns the currently active SRP record (the one with `isActive: true` and no `endDate`, or `endDate` in the future).

**Auth**: Public

**Success Response (200):**

```json
{
  "data": {
    "id": "clx...",
    "price": "230.00",
    "reference": "https://...",
    "startDate": "2026-02-14T16:00:00.000Z",
    "endDate": null,
    "isActive": true,
    "createdBy": { "id": "clx...", "name": "Default Admin" }
  },
  "errors": []
}
```

**Error Response (404):**

```json
{
  "data": null,
  "errors": [
    { "message": "No active SRP record found" }
  ]
}
```

### 3.4 `GET /api/srp/:id` — Get SRP by ID

Returns a single SRP record by its ID.

**Auth**: Public

**Success Response (200):** Same shape as a single item from the list.

**Error Response (404):**

```json
{
  "data": null,
  "errors": [
    { "message": "SRP record not found", "field": "id" }
  ]
}
```

---

## 4. Implementation Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | `SrpRecord` model definition |
| `src/schemas/srp.schema.ts` | Zod schemas (`CreateSrpSchema`, `ListSrpQuerySchema`, `GetSrpParamsSchema`) |
| `src/services/srp.service.ts` | Business logic: create, list, find active, find by ID, cascade logic |
| `src/controllers/srp.controller.ts` | Request handlers for SRP endpoints |
| `src/routes/srp.routes.ts` | Route definitions (`/api/srp/*`) |

---

## 5. Business Rules

1. **Price is in PHP** — always stored as `Decimal(10,2)` for precision. Never use floating point for currency.
2. **Reference is required** — every SRP must cite its DA source. Free-text (usually URL).
3. **Start date is required** — every SRP must have a defined effectivity start.
4. **End date is optional** — `null` means the record is currently active (no known end).
5. **Cascade on new record** — creating a new SRP auto-closes the previous active record. See [PRICE_HISTORY](PRICE_HISTORY.md).
6. **No edits to past records** — once an SRP's `startDate` has passed, it cannot be edited or deleted. See [PRICE_HISTORY](PRICE_HISTORY.md).
7. **`isActive` is managed by the server** — clients cannot set this directly. It is computed based on `startDate`, `endDate`, and cascade logic.
8. **Audit trail** — `createdById` tracks which admin created each record.

---

## 6. Testing Notes

- **Create SRP**: Verify record is created with correct price, reference, dates, and `createdById`.
- **Cascade**: Create two records; verify the first's `endDate` is auto-set. See [PRICE_HISTORY](PRICE_HISTORY.md).
- **List with pagination**: Create multiple records, verify page/limit/total.
- **Filter by active**: Verify only active records are returned when `isActive=true`.
- **Get active**: Verify the correct record is returned.
- **Get by ID (found)**: Verify full record shape.
- **Get by ID (not found)**: Verify 404 envelope.
- **Decimal precision**: Create a price of `229.99`, verify it's stored and returned as `"229.99"`.
- **Auth required on POST**: Verify 401 without token.
