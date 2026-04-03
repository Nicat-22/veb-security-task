const express = require('express');
const pool    = require('../db');
const { authMiddleware } = require('../middleware');

const router = express.Router();

// ── GET /api/paths ────────────────────────────────────────
// Bütün sahələr
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM paths WHERE is_active=true ORDER BY created_at'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server xətası' });
  }
});

// ── GET /api/paths/:slug/steps ────────────────────────────
// Bir sahənin addımları (istifadəçi progressi ilə)
router.get('/:slug/steps', async (req, res) => {
  const { slug } = req.params;

  // Token varsa istifadəçi progressini də qoş
  let userId = null;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
      userId = decoded.id;
    } catch { /* token yoxdur, normal davam et */ }
  }

  try {
    const pathResult = await pool.query(
      'SELECT * FROM paths WHERE slug=$1 AND is_active=true',
      [slug]
    );
    if (pathResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sahə tapılmadı' });
    }
    const path = pathResult.rows[0];

    let query, params;
    if (userId) {
      // Progress ilə birlikdə
      query = `
        SELECT s.*, COALESCE(up.status, 'not_started') AS progress
        FROM steps s
        LEFT JOIN user_progress up ON up.step_id=s.id AND up.user_id=$2
        WHERE s.path_id=$1
        ORDER BY s.order_num
      `;
      params = [path.id, userId];
    } else {
      query  = 'SELECT *, \'not_started\' AS progress FROM steps WHERE path_id=$1 ORDER BY order_num';
      params = [path.id];
    }

    const steps = await pool.query(query, params);
    res.json({ path, steps: steps.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server xətası' });
  }
});

// ── POST /api/paths/progress ──────────────────────────────
// Addımı tamamlandı işarələ
router.post('/progress', authMiddleware, async (req, res) => {
  const { stepId, status } = req.body;
  const validStatuses = ['not_started', 'in_progress', 'done'];

  if (!stepId || !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'step_id və etibarlı status tələb olunur' });
  }

  try {
    // Addımın pulsuz olub olmadığını yoxla
    const stepResult = await pool.query('SELECT is_free FROM steps WHERE id=$1', [stepId]);
    if (stepResult.rows.length === 0) {
      return res.status(404).json({ error: 'Addım tapılmadı' });
    }

    // Pulsuz addım deyilsə — Pro olub olmadığını yoxla
    if (!stepResult.rows[0].is_free) {
      const userResult = await pool.query('SELECT is_pro FROM users WHERE id=$1', [req.user.id]);
      if (!userResult.rows[0].is_pro) {
        return res.status(403).json({ error: 'Bu addım PRO abunəlik tələb edir' });
      }
    }

    await pool.query(
      `INSERT INTO user_progress (user_id, step_id, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, step_id) DO UPDATE SET status=$3, updated_at=NOW()`,
      [req.user.id, stepId, status]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server xətası' });
  }
});

module.exports = router;