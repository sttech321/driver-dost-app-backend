import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { registerSocketAuth } from './auth.js';
import { registerHandlers } from './handlers.js';

let io = null;

export function initIo(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigins.includes('*') ? true : env.corsOrigins,
      credentials: true,
    },
  });

  registerSocketAuth(io);
  io.on('connection', (socket) => {
    registerHandlers(io, socket);
  });

  console.log('[socket] Socket.IO ready');
  return io;
}

// Null-safe accessor so services/controllers can emit without hard-coupling.
export function getIo() {
  return io;
}
