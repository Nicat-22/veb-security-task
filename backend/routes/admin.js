const express = require('express');
const bcrypt  = require('bcryptjs');
const pool    = require('../db');
const { adminMiddleware } = require('../middleware');

const router = express.Router();
// Bütün admin route-larına admin yoxlaması tətbiq et
router.use(adminMiddleware);

// ── GET /api/admin/stats ──────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [users, proUsers, payments] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM users WHERE role='user'"),
      pool.query("SELECT COUNT(*) FROM users WHERE is_pro=true AND role='user'"),
      pool.query('SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE status=$1', ['success'])
    ]);
    res.json({
      totalUsers:  parseInt(users.rows[0].count),
      proUsers:    parseInt(proUsers.rows[0].count),
      totalRevenue: parseFloat(payments.rows[0].total)
    });
  } catch (err) {
    res.status(500).json({ error: 'Server xətası' });
  }
});

// ── GET /api/admin/users ──────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, username, email, role, is_pro, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server xətası' });
  }
});

// ── POST /api/admin/users ─────────────────────────────────
router.post('/users', async (req, res) => {
  const { name, username, email, password, role, is_pro } = req.body;
  if (!name || !username || !password) {
    return res.status(400).json({ error: 'Ad, istifadəçi adı və şifrə mütləqdir' });
  }
  try {
    const exists = await pool.query(
      'SELECT id FROM users WHERE username=$1', [username.toLowerCase()]
    );
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Bu istifadəçi adı artıq mövcuddur' });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, username, email, password_hash, role, is_pro)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, name, username, email, role, is_pro, created_at`,
      [name, username.toLowerCase(), email || '', hash, role || 'user', is_pro || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server xətası' });
  }
});

// ── PATCH /api/admin/users/:id/pro ───────────────────────
router.patch('/users/:id/pro', async (req, res) => {
  const { is_pro } = req.body;
  try {
    await pool.query('UPDATE users SET is_pro=$1 WHERE id=$2', [is_pro, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server xətası' });
  }
});

// ── DELETE /api/admin/users/:id ───────────────────────────
router.delete('/users/:id', async (req, res) => {
  // Özünü silə bilməz
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Öz hesabınızı silə bilməzsiniz' });
  }
  try {
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server xətası' });
  }
});

// ── GET /api/admin/payments ───────────────────────────────
router.get('/payments', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.username, u.name AS user_name
       FROM payments p
       JOIN users u ON u.id=p.user_id
       ORDER BY p.paid_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server xətası' });
  }
});

module.exports = router;