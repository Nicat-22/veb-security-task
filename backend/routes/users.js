const express = require('express');
const pool    = require('../db');
const { authMiddleware } = require('../middleware');

const router = express.Router();

// ── GET /api/users/profile ────────────────────────────────
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, username, email, role, is_pro, created_at FROM users WHERE id=$1',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server xətası' });
  }
});

module.exports = router;