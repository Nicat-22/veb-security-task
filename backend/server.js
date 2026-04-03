require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const pool    = require('./db');

const authRoutes     = require('./routes/auth');
const usersRoutes    = require('./routes/users');
const paymentsRoutes = require('./routes/payments');
const pathsRoutes    = require('./routes/paths');
const adminRoutes    = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());

// ── Routes ───────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/users',    usersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/paths',    pathsRoutes);
app.use('/api/admin',    adminRoutes);

// ── Sağlamlıq yoxlaması ──────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', time: new Date() });
  } catch {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// ── Mövcud olmayan route ─────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route tapılmadı' });
});

// ── Global xəta tutucusu ─────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server xətası:', err.message);
  res.status(500).json({ error: 'Server xətası baş verdi' });
});

// ── Server başlat ────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server işləyir: http://localhost:${PORT}`);
  console.log(`📋 API sağlamlıq: http://localhost:${PORT}/api/health`);
});