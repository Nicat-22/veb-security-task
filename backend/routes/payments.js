const express = require('express');
const pool    = require('../db');
const { authMiddleware } = require('../middleware');

const router = express.Router();

// ── POST /api/payments/checkout ───────────────────────────
// İstifadəçi Pro abunəlik alır
router.post('/checkout', authMiddleware, async (req, res) => {
  const { cardName, cardNumber, cardExpiry } = req.body;

  if (!cardName || !cardNumber || !cardExpiry) {
    return res.status(400).json({ error: 'Kart məlumatları natamamdır' });
  }

  // Yalnız son 4 rəqəmi saxla
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 16) {
    return res.status(400).json({ error: 'Kart nömrəsi etibarsızdır' });
  }
  const masked = '**** **** **** ' + digits.slice(-4);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ödəniş qeydi yarat
    await client.query(
      `INSERT INTO payments (user_id, card_holder, card_masked, card_expiry, amount, status)
       VALUES ($1, $2, $3, $4, 9.99, 'success')`,
      [req.user.id, cardName.toUpperCase(), masked, cardExpiry]
    );

    // İstifadəçini Pro et
    await client.query(
      'UPDATE users SET is_pro=true WHERE id=$1',
      [req.user.id]
    );

    await client.query('COMMIT');

    res.json({ success: true, message: 'Ödəniş uğurlu. Pro aktivləşdi!' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Ödəniş xətası:', err.message);
    res.status(500).json({ error: 'Ödəniş zamanı xəta baş verdi' });
  } finally {
    client.release();
  }
});

// ── GET /api/payments/my ──────────────────────────────────
// Cari istifadəçinin ödənişləri
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, card_holder, card_masked, card_expiry, amount, status, paid_at
       FROM payments WHERE user_id=$1 ORDER BY paid_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server xətası' });
  }
});

module.exports = router;