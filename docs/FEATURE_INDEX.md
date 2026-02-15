# PigWeigh Server - Feature Index

> **Purpose**: Central navigation hub for all Express server features and documentation.

---

## Overview

**PigWeigh Server** is a RESTful Express.js API backend for the PigWeigh application (Flutter mobile app). The app weighs pigs via an on-device ML model; the server's responsibility is managing the **official SRP (Suggested Retail Price)** from the Philippine DA, **real-time publication** of new prices via WebSocket, and **price history management**. The API is designed with a consistent `{ data, errors }` envelope for all responses.

### Technology Stack

| Technology     | Version | Purpose                |
| -------------- | ------- | ---------------------- |
| **Node.js**    | -       | Runtime environment    |
| **Express.js** | ^5.2.1  | Web framework          |
| **TypeScript** | ^5.9.3  | Type-safe JavaScript   |
| **Prisma**     | ^7.2.0  | ORM / Database client  |
| **PostgreSQL** | -       | Primary database       |
| **Zod**        | ^4.3.5  | Request validation     |
| **Socket.IO**  | -       | Real-time WebSocket    |
| **bcrypt**     | -       | Password hashing       |
| **jsonwebtoken** | -     | JWT authentication     |

### Architecture Approach

- **REST API** with JSON responses
- **Controller-Service pattern** for business logic separation
- **Middleware-based** request validation and authentication
- **Standardized API responses** with consistent `{ data, errors }` structure (see [CONTEXT.md — API Response Envelope](CONTEXT.md#api-response-envelope))
- **Real-time push** via Socket.IO for SRP publications
- **Time-zone agnostic** — all timestamps stored as UTC with timezone (`timestamptz`)

---

## Documentation Structure

| Document                               | Purpose                                                |
| -------------------------------------- | ------------------------------------------------------ |
| [CONTEXT.md](CONTEXT.md)              | Core infrastructure, patterns, conventions, utilities  |
| [FEATURE_INDEX.md](FEATURE_INDEX.md)  | This file — navigation hub                             |
| [FEATURE_PROMPT.md](FEATURE_PROMPT.md)| Reusable prompt for generating feature docs            |

---

## Features

| # | Document | Purpose | Dependencies |
|---|----------|---------|-------------|
| 0 | [features/TIME_HANDLING.md](features/TIME_HANDLING.md) | UTC timestamptz convention for all date/time fields | None (foundation) |
| 1 | [features/ADMIN_AUTH.md](features/ADMIN_AUTH.md) | Admin login (seeded), JWT auth middleware | TIME_HANDLING |
| 2 | [features/SRP_MANAGEMENT.md](features/SRP_MANAGEMENT.md) | CRUD for official DA Suggested Retail Price records | TIME_HANDLING, ADMIN_AUTH |
| 3 | [features/REALTIME_SRP.md](features/REALTIME_SRP.md) | Socket.IO push notifications for new SRP publications | SRP_MANAGEMENT |
| 4 | [features/PRICE_HISTORY.md](features/PRICE_HISTORY.md) | Cascade logic, immutability, history view & filtering | SRP_MANAGEMENT |

> **Implementation order**: Follow the `#` column top-to-bottom. Each feature builds on its dependencies.

---

## API Endpoints Summary

| Method | Path | Auth | Feature | Description |
| ------ | ---- | ---- | ------- | ----------- |
| GET  | `/health`         | —      | Core            | Health check |
| POST | `/api/auth/login` | Public | ADMIN_AUTH      | Admin login, returns JWT |
| GET  | `/api/auth/me`    | Bearer | ADMIN_AUTH      | Get current admin profile |
| POST | `/api/srp`        | Bearer | SRP_MANAGEMENT  | Create a new SRP record (triggers cascade + broadcast) |
| GET  | `/api/srp`        | Public | SRP_MANAGEMENT  | List SRP records (paginated, filterable) |
| GET  | `/api/srp/active` | Public | SRP_MANAGEMENT  | Get the currently active SRP record |
| GET  | `/api/srp/:id`    | Public | SRP_MANAGEMENT  | Get a single SRP record by ID |

### WebSocket Events (Socket.IO)

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `srp:new` | Server → Client | `SrpRecord` | Broadcast when a new SRP record is created |

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
