import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, closeDb } from './db.js';
import { playerSession } from './middleware/session.js';
import { registerSocketHandlers } from './socket-handlers.js';
import adminRoutes from './routes/admin.js';
import playerRoutes from './routes/player.js';
import gameRoutes from './routes/game.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  pingTimeout: 60000,
  pingInterval: 25000,
});

const PORT = process.env.PORT || 3000;

// Initialize database
const db = getDb();
console.log('[DB] SQLite database initialized');

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
  app.use(express.static(clientDist));

  // SPA fallback — all non-API routes serve index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ─── Error handler ──────────────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.stack || err.message);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// ─── Start server ───────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[SERVER] Les Immortels running on http://localhost:${PORT}`);
});

// ─── Graceful shutdown ──────────────────────────────────────────────────────

function shutdown() {
  console.log('[SERVER] Shutting down...');
  server.close(() => {
    closeDb();
    console.log('[SERVER] Goodbye');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
