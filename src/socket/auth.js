import { verifyAuthToken } from '../utils/jwt.js';
import { prisma } from '../config/prisma.js';

// Authenticate the socket on the handshake using the same JWT as REST.
// Attaches socket.data.user (+ socket.data.driver for DRIVER accounts).
export function registerSocketAuth(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('No auth token'));

      const payload = verifyAuthToken(token);
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) return next(new Error('User not found'));

      socket.data.user = user;
      if (user.role === 'DRIVER') {
        socket.data.driver = await prisma.driver.findUnique({ where: { userId: user.id } });
      }
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });
}
