const jwt = require('jsonwebtoken');

/**
 * Middleware to verify admin authentication
 */
module.exports = function(req, res, next) {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if no token
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    // Verify token with the same JWT_SECRET used in authRoutes.js
    const JWT_SECRET = process.env.JWT_SECRET || 'your_default_secret_key';
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if user has admin role
    if (!decoded.role || decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    // Add user info to request
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};