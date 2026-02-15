import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger';
import { sendSuccess } from './utils/response';
import { initializeSocket } from './socket';
import authRoutes from './routes/auth.routes';
import srpRoutes from './routes/srp.routes';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Socket.IO
// ---------------------------------------------------------------------------
initializeSocket(server);

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  sendSuccess(res, { status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/srp', srpRoutes);

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------
server.listen(PORT, () => {
  logger.info(`🐷 PigWeigh server running on port ${PORT}`);
});

export default app;
