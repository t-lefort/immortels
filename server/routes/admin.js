import { Router } from 'express';
import { adminAuth } from '../middleware/auth.js';
import { getDb, getAllSettings, setSetting } from '../db.js';

const router = Router();

// All admin routes require authentication
router.use(adminAuth);

// ─── Setup ──────────────────────────────────────────────────────────────────

router.post('/players/bulk', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

router.delete('/players/:id', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

router.get('/players', (req, res) => {
  const players = getDb().prepare('SELECT * FROM players ORDER BY id').all();
  res.json(players);
});

router.post('/game/assign-roles', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

router.post('/game/start', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

// ─── Phases ─────────────────────────────────────────────────────────────────

router.post('/phase/create', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

router.post('/phase/start', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

router.post('/phase/open-voting', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

router.post('/phase/close-voting', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

router.get('/phase/results', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

router.post('/phase/reveal', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

router.post('/phase/skip', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

router.get('/phase/votes', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

router.post('/phase/speech-order', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

router.post('/timer/start', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

// ─── Special powers ─────────────────────────────────────────────────────────

router.post('/special/trigger', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

router.post('/special/force', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

// ─── Challenges ─────────────────────────────────────────────────────────────

router.post('/challenge', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

router.post('/challenge/assign', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

// ─── Overrides ──────────────────────────────────────────────────────────────

router.put('/player/:id', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

router.post('/phase/undo', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

router.put('/settings', (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Body must be a JSON object of key/value pairs' });
  }
  for (const [key, value] of Object.entries(updates)) {
    setSetting(key, value);
  }
  res.json(getAllSettings());
});

router.post('/game/reset', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

router.post('/wolf-tie-break', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

export default router;
