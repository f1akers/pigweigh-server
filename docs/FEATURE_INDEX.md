# PigWeigh Server - Feature Index

> **Purpose**: Central navigation hub for all Express server features and documentation.

---

## Overview

**PigWeigh Server** is a RESTful Express.js API backend for the PigWeigh application (including the Flutter mobile app). It provides pig management, weighing, and supporting services. The API is designed with a consistent `{ data, errors }` envelope for all responses.

### Technology Stack

| Technology     | Version | Purpose                |
| -------------- | ------- | ---------------------- |
| **Node.js**    | -       | Runtime environment    |
| **Express.js** | ^5.2.1  | Web framework          |
| **TypeScript** | ^5.9.3  | Type-safe JavaScript   |
| **Prisma**     | ^7.2.0  | ORM / Database client  |
| **PostgreSQL** | -       | Primary database       |
| **Zod**        | ^4.3.5  | Request validation     |

### Architecture Approach

- **REST API** with JSON responses
- **Controller-Service pattern** for business logic separation
- **Middleware-based** request validation and authentication
- **Standardized API responses** with consistent `{ data, errors }` structure (see [CONTEXT.md — API Response Envelope](CONTEXT.md#api-response-envelope))

---

## Documentation Structure

| Document                               | Purpose                                                |
| -------------------------------------- | ------------------------------------------------------ |
| [CONTEXT.md](CONTEXT.md)              | Core infrastructure, patterns, conventions, utilities  |
| [FEATURE_INDEX.md](FEATURE_INDEX.md)  | This file — navigation hub                             |
| [FEATURE_PROMPT.md](FEATURE_PROMPT.md)| Reusable prompt for generating feature docs            |

---

## Features

<!-- Add features here as they are built. Use the format below: -->
<!-- | [features/FEATURE.md](features/FEATURE.md) | Brief description | -->

| Document | Purpose |
| -------- | ------- |
| _None yet_ | Features will be documented here as they are built. |

---

## API Endpoints Summary

<!-- Maintain a quick-reference table of all endpoints as features are added. -->

| Method | Path | Feature | Description |
| ------ | ---- | ------- | ----------- |
| GET | `/health` | Core | Health check |

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .env.example .env
# Edit .env with your database URL and other config

# 3. Run database migrations
npx prisma migrate dev

# 4. Start development server
npm run dev
```

See [CONTEXT.md](CONTEXT.md) for full development conventions and patterns.
