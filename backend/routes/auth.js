const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const { authMiddleware } = require('../middleware');

const router = express.Router();

// ── POST /api/auth/register ───────────────────────────────
router.post('/register', async (req, res) => {
  const { name, username, email, password } = req.body;

  if (!name || !username || !email || !password) {
    return res.status(400).json({ error: 'Bütün sahələr mütləqdir' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Şifrə ən az 6 simvol olmalıdır' });
  }

  try {
    const exists = await pool.query(
      'SELECT id FROM users WHERE username=$1 OR email=$2',
      [username.toLowerCase(), email.toLowerCase()]
    );
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Bu istifadəçi adı və ya e-poçt artıq mövcuddur' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, username, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, username, email, role, is_pro, created_at`,
      [name, username.toLowerCase(), email.toLowerCase(), hash]
    );

    const user  = result.rows[0];
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register xətası:', err.message);
    res.status(500).json({ error: 'Qeydiyyat zamanı xəta baş verdi' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────
// ✅ TƏHLÜKƏSİZ VERSİYA — Parametrli sorğular istifadə edilir
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'İstifadəçi adı və şifrə tələb olunur' });
  }

  try {
    // ✅ TƏHLÜKƏSİZ: $1 parametri SQL injection-ı bloklayır
    const result = await pool.query(
      'SELECT * FROM users WHERE username=$1',
      [username.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Yanlış istifadəçi adı və ya şifrə' });
    }

    const user  = result.rows[0];

    // ✅ TƏHLÜKƏSİZ: bcrypt ilə şifrə yoxlanır
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Yanlış istifadəçi adı və ya şifrə' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Login xətası:', err.message);
    res.status(500).json({ error: 'Giriş zamanı xəta baş verdi' });
  }
});

// ── GET /api/auth/me  (token ilə cari istifadəçi) ─────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, username, email, role, is_pro, created_at FROM users WHERE id=$1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'İstifadəçi tapılmadı' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server xətası' });
  }
});

module.exports = router;