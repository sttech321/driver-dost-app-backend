import http from 'node:http';
import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { getFirebaseApp } from './config/firebase.js';
import { initIo } from './socket/io.js';

async function start() {
  // Warm up integrations (non-fatal if Firebase isn't configured).
  getFirebaseApp();

  try {
    await prisma.$connect();
    console.log('[db] Connected to PostgreSQL');
  } catch (err) {
    console.error('[db] Could not connect to PostgreSQL:', err.message);
    console.error('     Set DATABASE_URL and run `npm run prisma:migrate`.');
  }

  // Wrap Express in an HTTP server so Socket.IO can share the same port.
  const server = http.createServer(app);
  initIo(server);

  server.listen(env.port, () => {
    console.log(`[server] Driver Dost API listening on http://localhost:${env.port}`);
  });

  const shutdown = async () => {
    console.log('\n[server] Shutting down...');
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
