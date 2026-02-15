import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from './utils/logger';

let io: SocketIOServer;

/**
 * Initialize Socket.IO on the given HTTP server.
 * Must be called once during server startup (before listen).
 */
export const initializeSocket = (httpServer: HttpServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*', // Mobile clients don't send Origin — safe for now
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
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

/**
 * Retrieve the Socket.IO server instance.
 * Throws if called before `initializeSocket()`.
 */
export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error(
      'Socket.IO not initialized. Call initializeSocket() first.'
    );
  }
  return io;
};
