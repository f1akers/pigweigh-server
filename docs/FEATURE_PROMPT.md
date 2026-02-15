# Feature Documentation Prompt

> **Purpose**: Copy-paste this prompt when asking an AI agent to document a new feature.

---

## Prompt

```
You are a Senior Backend Engineer documenting a feature for the PigWeigh Express.js server.

Write a feature document in Markdown for: **[FEATURE NAME]**

The document should follow this structure:

## 1. Overview
- Brief description of the feature
- Why it exists / business context

## 2. Database Schema
- Prisma models involved (paste the relevant schema block)
- Relationships and constraints

## 3. API Endpoints
Table with: Method | Path | Auth | Description
For each endpoint, document:
- Request body / params / query (with Zod schema reference)
- Success response shape (using { data, errors } envelope)
- Error responses and status codes

## 4. Implementation Files
Table mapping each file to its purpose:
| File | Purpose |
| --- | --- |
| `src/schemas/<feature>.schema.ts` | Zod validation schemas |
| `src/services/<feature>.service.ts` | Business logic + Prisma queries |
| `src/controllers/<feature>.controller.ts` | Request handlers |
| `src/routes/<feature>.routes.ts` | Route definitions |

## 5. Business Rules
- Validation rules
- Authorization rules
- Edge cases and constraints

## 6. Testing Notes
- Key scenarios to test
- Edge cases

Follow the conventions from CONTEXT.md:
- Use { data, errors } response envelope
- Use logger (never console.log)
- Use Zod for validation
- Controller-Service pattern
```

---

Place the resulting document in `docs/features/<FEATURE_NAME>.md` and add a row to the Features table in `FEATURE_INDEX.md`.
