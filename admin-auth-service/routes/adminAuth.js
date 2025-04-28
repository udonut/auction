// admin-auth-service/routes/adminAuth.js
const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

// POST /admin/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];
  if (!user || user.role !== 'admin') {
    return res.status(401).json({ message: 'Invalid admin credentials' });
  }
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return res.status(401).json({ message: 'Invalid admin credentials' });
  }
  const token = jwt.sign(
    { id: user.id, role: 'admin' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
  res.json({
    token,
    user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role }
  });
});

// GET /admin/verify
router.get('/verify', (req, res) => {
  const token = req.header('x-auth-token');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') throw new Error();
    res.json({ valid: true });
  } catch {
    res.status(401).json({ valid: false });
  }
});

module.exports = router;