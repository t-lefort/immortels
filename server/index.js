import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, closeDb } from './db.js';
import { playerSession } from './middleware/session.js';
import { registerSocketHandlers } from './socket-handlers.js';
import { recoverState } from './state-recovery.js';
import adminRoutes from './routes/admin.js';
import playerRoutes from './routes/player.js';
import gameRoutes from './routes/game.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// Trust proxy for Cloudflare reverse proxy (correct IP, secure cookies)
app.set('trust proxy', 1);

const io = new Server(server, {
  pingTimeout: 60000,
  pingInterval: 25000,
  cors: process.env.NODE_ENV === 'production'
    ? { origin: true, credentials: true }
    : { origin: '*' },
});

const PORT = process.env.PORT || 3000;

// Initialize database
const db = getDb();
console.log('[DB] SQLite database initialized');

// Recover game state from SQLite on startup
try {
  const recoveredState = recoverState();
  console.log('[SERVER] State recovery completed successfully');
} catch (err) {
  console.error('[SERVER] State recovery failed (non-fatal):', err.message);
}

// ─── Middleware ──────────────────────────────────────────────────────────────

app.use(express.json());
app.use(cookieParser());
app.use(playerSession);

// Make io accessible from routes
app.set('io', io);

// ─── API Routes ─────────────────────────────────────────────────────────────

app.use('/api/admin', adminRoutes);
app.use('/api/player', playerRoutes);
app.use('/api/game', gameRoutes);

// ─── Socket.IO ──────────────────────────────────────────────────────────────

registerSocketHandlers(io);

// ─── Static files & SPA fallback (production) ───────────────────────────────

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');

  // Serve hashed Vite assets with long-term caching
  app.use('/assets', express.static(path.join(clientDist, 'assets'), {
    maxAge: '1y',
    immutable: true,
  }));

  // Serve other static files (index.html, favicon, etc.) with no-cache
  app.use(express.static(clientDist));

  // SPA fallback — all non-API routes serve index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ─── Global error handler ───────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  const timestamp = new Date().toISOString();
  console.error(`[ERROR ${timestamp}]`, err.message);

  // Don't expose stack traces in production
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // Don't send headers if already sent
  if (res.headersSent) {
    return;
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Erreur interne du serveur'
    : err.message || 'Erreur interne du serveur';

  res.status(statusCode).json({ error: message });
});

// ─── Unhandled rejection / uncaught exception handlers ──────────────────────

process.on('unhandledRejection', (reason, promise) => {
  const timestamp = new Date().toISOString();
  console.error(`[UNHANDLED REJECTION ${timestamp}]`, reason);
});

process.on('uncaughtException', (err) => {
  const timestamp = new Date().toISOString();
  console.error(`[UNCAUGHT EXCEPTION ${timestamp}]`, err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }
  // Attempt graceful shutdown on uncaught exception
  shutdown();
});

// ─── Start server ───────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[SERVER] Les Immortels running on http://localhost:${PORT}`);
});

// ─── Graceful shutdown ──────────────────────────────────────────────────────

let isShuttingDown = false;

function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('[SERVER] Shutting down gracefully...');

  // Force exit after 5 seconds if graceful shutdown hangs
  const forceExitTimeout = setTimeout(() => {
    console.error('[SERVER] Forced shutdown after timeout');
    process.exit(1);
  }, 5000);
  // Allow the process to exit naturally if everything closes in time
  forceExitTimeout.unref();

  // Close Socket.IO connections gracefully
  io.close(() => {
    console.log('[SERVER] Socket.IO connections closed');
  });

  // Close HTTP server (stop accepting new connections)
  server.close(() => {
    console.log('[SERVER] HTTP server closed');

    // Close SQLite database
    try {
      closeDb();
      console.log('[SERVER] Database closed');
    } catch (err) {
      console.error('[SERVER] Error closing database:', err.message);
    }

    console.log('[SERVER] Goodbye');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
