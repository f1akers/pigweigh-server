# Feature: Real-Time SRP Publication

> **Status**: Planned
> **Depends on**: [TIME_HANDLING](TIME_HANDLING.md), [ADMIN_AUTH](ADMIN_AUTH.md), [SRP_MANAGEMENT](SRP_MANAGEMENT.md)

---

## 1. Overview

The Flutter mobile app can **subscribe in real time** to SRP publications via a Socket.IO WebSocket connection. When an admin creates a new SRP record, all connected clients are notified instantly without polling.

This feature turns PigWeigh from a request-response API into a **live data feed** for price updates.

### Why It Exists

- Pig farmers and traders need to know immediately when the DA publishes a new SRP.
- Polling from hundreds of mobile clients is wasteful; push-based WebSocket is efficient and instant.
- Socket.IO provides automatic reconnection, fallback transports, and room-based broadcasting — ideal for mobile clients on unreliable networks.

---

## 2. Architecture

```
┌────────────────┐       POST /api/srp        ┌─────────────────┐
│  Admin (App)   │ ──────────────────────────► │  Express Server  │
└────────────────┘                             │                  │
                                               │  ┌────────────┐ │
                                               │  │ SRP Service │ │
                                               │  └─────┬──────┘ │
                                               │        │ emit   │
                                               │  ┌─────▼──────┐ │
                                               │  │ Socket.IO   │ │
                                               │  │   Server    │ │
                                               │  └─────┬──────┘ │
                                               └────────┼────────┘
                                                        │
                            ┌───────────────────────────┼────────────────────┐
                            │                           │                    │
                     ┌──────▼──────┐             ┌──────▼──────┐      ┌──────▼──────┐
                     │  Client A   │             │  Client B   │      │  Client C   │
                     │  (Flutter)  │             │  (Flutter)  │      │  (Flutter)  │
                     └─────────────┘             └─────────────┘      └─────────────┘
```

### Key Design Decisions

1. **Socket.IO over raw WebSocket** — provides auto-reconnect, binary support, room-based broadcasting, and fallback to HTTP long-polling for restrictive networks.
2. **Server-to-client only** — clients only listen; they do not send data over the socket. All writes go through REST endpoints.
3. **No socket authentication required for listening** — SRP data is public. Any connected client receives broadcasts.
4. **Single namespace, single event** — keep it simple. One namespace (`/`), one broadcast event (`srp:new`).

---

## 3. Socket.IO Events

### 3.1 Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `srp:new` | `SrpRecord` object | Emitted when a new SRP record is created |

**Payload shape:**

```json
{
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
  "createdAt": "2026-02-15T00:00:00.000Z"
}
```

### 3.2 Client → Server Events

None. Clients are passive listeners. All mutations happen through REST.

### 3.3 Connection Events (built-in)

| Event | Direction | Description |
|-------|-----------|-------------|
| `connection` | Client → Server | Client connects |
| `disconnect` | Client → Server | Client disconnects |

The server should log connection/disconnection events for monitoring:

```typescript
io.on('connection', (socket) => {
  logger.info('Client connected', { socketId: socket.id });

  socket.on('disconnect', (reason) => {
    logger.info('Client disconnected', { socketId: socket.id, reason });
  });
});
```

---

## 4. Integration with SRP Service

The emission happens **inside the SRP service** (or controller) after a successful record creation. The Socket.IO server instance must be accessible from the service layer.

### Approach: Export `io` instance from setup

```typescript
// src/socket.ts
import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from './utils/logger';

let io: SocketIOServer;

export const initializeSocket = (httpServer: HttpServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*', // Tighten in production
    },
  });

  io.on('connection', (socket) => {
    logger.info('Client connected', { socketId: socket.id });

    socket.on('disconnect', (reason) => {
      logger.info('Client disconnected', { socketId: socket.id, reason });
    });
  });

  logger.info('Socket.IO initialized');
  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocket() first.');
  }
  return io;
};
```

### Emission in SRP Service

```typescript
// Inside srp.service.ts — after creating a new record
import { getIO } from '../socket';

const newRecord = await prisma.srpRecord.create({ ... });

// Broadcast to all connected clients
getIO().emit('srp:new', newRecord);
```

---

## 5. Server Setup Changes

The Express app must be wrapped in an HTTP server to share it with Socket.IO:

```typescript
// src/index.ts (modified)
import http from 'http';
import { initializeSocket } from './socket';

const app = express();
const server = http.createServer(app);
initializeSocket(server);

// ... middleware, routes ...

server.listen(PORT, () => {
  logger.info(`🐷 PigWeigh server running on port ${PORT}`);
});
```

---

## 6. Implementation Files

| File | Purpose |
|------|---------|
| `src/socket.ts` | Socket.IO server initialization, `getIO()` accessor |
| `src/index.ts` | Modified to create HTTP server and init Socket.IO |
| `src/services/srp.service.ts` | Emits `srp:new` after record creation |

---

## 7. Dependencies

| Package | Purpose |
|---------|---------|
| `socket.io` | Socket.IO server |

The Flutter app will use the `socket_io_client` Dart package to connect.

---

## 8. CORS / Transport Configuration

```typescript
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',         // Allow all origins (mobile app)
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'], // Prefer WebSocket, fall back to polling
});
```

> **Note**: For mobile apps, `origin: '*'` is acceptable since mobile clients don't send `Origin` headers the same way browsers do. Tighten if a web admin panel is added later.

---

## 9. Business Rules

1. **Broadcast is fire-and-forget** — if a client is disconnected at the moment of emission, they miss it. They should fetch the latest SRP via `GET /api/srp/active` on reconnect.
2. **No socket authentication** — SRP data is public. Any client can connect and listen.
3. **No client-to-server data** — sockets are read-only from the client's perspective.
4. **Log connections** — monitor connected client count for operational awareness.
5. **Emit after commit** — only emit the `srp:new` event after the database transaction succeeds. Never emit on a pending/uncommitted write.

---

## 10. Client Reconnection Strategy

The Flutter app should:

1. Connect to the Socket.IO server on app startup.
2. Listen for `srp:new` events.
3. On reconnect (automatic via Socket.IO), fetch `GET /api/srp/active` to catch any missed publications.
4. Display a "new price available" notification or automatically refresh the price display.

---

## 11. Testing Notes

- **Connection**: Connect a Socket.IO test client, verify `connection` is logged.
- **Broadcast on create**: Create a new SRP via POST, verify the connected test client receives `srp:new` with correct payload.
- **Multiple clients**: Connect 3 clients, create an SRP, verify all 3 receive the event.
- **Disconnected client**: Disconnect a client, create an SRP, reconnect, verify the client can fetch via REST (no missed event guarantee).
- **Payload shape**: Verify the emitted payload matches the documented JSON shape (includes `createdBy`, ISO dates, decimal string for price).
- **No emit on validation failure**: Send an invalid SRP POST, verify no socket event is emitted.
