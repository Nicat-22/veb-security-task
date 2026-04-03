const jwt  = require('jsonwebtoken');
const pool = require('./db');

// ── Token yoxlama middleware ──────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token tələb olunur' });
  }
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token etibarsızdır və ya vaxtı keçib' });
  }
}

// ── Admin yoxlama middleware ──────────────────────────────
function adminMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin icazəsi tələb olunur' });
    }
    next();
  });
}

module.exports = { authMiddleware, adminMiddleware };