import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger';
import { sendSuccess } from './utils/response';
import authRoutes from './routes/auth.routes';
import srpRoutes from './routes/srp.routes';

const app = express();
const PORT = process.env.PORT || 3000;

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
app.listen(PORT, () => {
  logger.info(`🐷 PigWeigh server running on port ${PORT}`);
});

export default app;
