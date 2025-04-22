const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const adminAuth = require('./middleware/adminAuth'); // Add this line to import adminAuth middleware
const authMiddleware = require('./middleware/auth'); // Add this line to import auth middleware

// Secret key for JWT
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_secret_key';

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;
    
    // Check if user already exists
    const userExists = await pool.query(
      'SELECT * FROM users WHERE email = $1', 
      [email]
    );
    
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Add admin role for specific admin emails
    const isAdmin = ['admin@bidmaster.com'].includes(email);
    const role = isAdmin ? 'admin' : 'user';
    
    // Insert user with role
    const newUser = await pool.query(
      'INSERT INTO users (full_name, email, phone, password, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email, phone, role',
      [fullName, email, phone, hashedPassword, role]
    );
    
    // Generate JWT token
    const token = jwt.sign(
      { id: newUser.rows[0].id, email, role: newUser.rows[0].role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.rows[0].id,
        fullName: newUser.rows[0].full_name,
        email: newUser.rows[0].email,
        role: newUser.rows[0].role
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (user.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.rows[0].password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Generate JWT
    const token = jwt.sign(
      { 
        id: user.rows[0].id,
        email: user.rows[0].email,
        role: user.rows[0].role // 'user' or 'admin'
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    res.status(200).json({
      token,
      user: {
        id: user.rows[0].id,
        email: user.rows[0].email,
        fullName: user.rows[0].full_name, // Using fullName consistently
        role: user.rows[0].role
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add this new admin login endpoint

/**
 * Admin Login route - validates credentials and checks admin privilege
 */
router.post('/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if user has admin role
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    // Create and sign JWT token with admin flag
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        isAdmin: true 
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Inside the admin-login endpoint, after successful login:
    // Add this right before sending the response
    if (user.role === 'admin') {
      try {
        await pool.query(
          'INSERT INTO admin_activity_log (admin_id, action_type, action_details) VALUES ($1, $2, $3)',
          [user.id, 'login', `Admin login from IP: ${req.ip}`]
        );
      } catch (err) {
        console.error('Error logging admin activity:', err);
        // Continue with login even if logging fails
      }
    }

    // Send response with token and user info
    res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name, 
        name: user.full_name,     // For backward compatibility
        role: user.role
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error during admin login' });
  }
});

// Add this endpoint to verify admin tokens

/**
 * Verify admin token
 */
router.get('/verify-admin', adminAuth, (req, res) => {
  // If adminAuth middleware passes, the token is valid
  res.status(200).json({ valid: true });
});

// Protected route to get user profile data
router.get('/profile', async (req, res) => {
  try {
    // Get user ID from token
    const token = req.header('x-auth-token');
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    
    try {
      // Verify token
      const JWT_SECRET = process.env.JWT_SECRET || 'your_default_secret_key';
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Update this query in the GET /profile route
      const userResult = await pool.query(
        'SELECT id, full_name, email, phone, about_me, profile_image, created_at FROM users WHERE id = $1',
        [decoded.id]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      console.log('User profile data:', {
        id: userResult.rows[0].id,
        fullName: userResult.rows[0].full_name,
        email: userResult.rows[0].email,
        created_at: userResult.rows[0].created_at
      });
      
      // And include it in the response JSON:
      res.json({
        user: {
          id: userResult.rows[0].id,
          fullName: userResult.rows[0].full_name,
          email: userResult.rows[0].email,
          phone: userResult.rows[0].phone || '', // Handle null/undefined phone
          aboutMe: userResult.rows[0].about_me || '', // Handle null/undefined aboutMe
          profileImage: userResult.rows[0].profile_image, // Add this line
          createdAt: userResult.rows[0].created_at
        }
      });
      
    } catch (err) {
      return res.status(401).json({ message: 'Token is not valid' });
    }
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    // Get user ID from token
    const token = req.header('x-auth-token');
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Get updated profile data
      const { fullName, email, phone, aboutMe } = req.body;
      
      // Debug logging
      console.log('Updating profile for user:', decoded.id);
      console.log('New data:', { fullName, email, phone, aboutMe });
      
      // Update user profile in database
      const updateResult = await pool.query(
        'UPDATE users SET full_name = $1, email = $2, phone = $3, about_me = $4 WHERE id = $5 RETURNING id, full_name, email, phone, about_me, created_at',
        [fullName, email, phone, aboutMe, decoded.id]
      );
      
      if (updateResult.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json({
        message: 'Profile updated successfully',
        user: {
          id: updateResult.rows[0].id,
          fullName: updateResult.rows[0].full_name,
          email: updateResult.rows[0].email,
          phone: updateResult.rows[0].phone || '',
          aboutMe: updateResult.rows[0].about_me || '',
          createdAt: updateResult.rows[0].created_at  // Add this line
        }
      });
      
    } catch (err) {
      console.error('Token validation error:', err);
      return res.status(401).json({ message: 'Token is not valid' });
    }
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add this route after your existing routes
// Update password route
router.put('/change-password', async (req, res) => {
  try {
    // Get user ID from token
    const token = req.header('x-auth-token');
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Get password data
      const { currentPassword, newPassword } = req.body;
      
      // Get user from database to check current password
      const userResult = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [decoded.id]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Check if current password matches
      const isMatch = await bcrypt.compare(currentPassword, userResult.rows[0].password);
      
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      
      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      // Update password in database
      await pool.query(
        'UPDATE users SET password = $1 WHERE id = $2',
        [hashedPassword, decoded.id]
      );
      
      res.json({ message: 'Password updated successfully' });
      
    } catch (err) {
      console.error('Token validation error:', err);
      return res.status(401).json({ message: 'Token is not valid' });
    }
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add this new profile picture endpoint after your existing routes

// Profile picture update
router.put('/profile-picture', authMiddleware, async (req, res) => {
  try {
    const { profileImage } = req.body;
    const userId = req.user.id;

    // If profileImage is empty, remove it from DB
    if (profileImage === '') {
      await pool.query(
        'UPDATE users SET profile_image = NULL WHERE id = $1',
        [userId]
      );
      return res.json({ message: 'Profile image removed' });
    }
    
    // Debug logging
    console.log('Updating profile picture for user:', req.user.id);
    console.log('Profile image URL:', profileImage.substring(0, 50) + '...');
    
    try {
      // Update user profile in database - user.id comes from the middleware now
      const updateResult = await pool.query(
        'UPDATE users SET profile_image = $1 WHERE id = $2 RETURNING id, full_name, email, phone, about_me, profile_image, created_at',
        [profileImage, req.user.id]
      );
      
      if (updateResult.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json({
        message: 'Profile picture updated successfully',
        user: {
          id: updateResult.rows[0].id,
          fullName: updateResult.rows[0].full_name,
          email: updateResult.rows[0].email,
          phone: updateResult.rows[0].phone || '',
          aboutMe: updateResult.rows[0].about_me || '',
          profileImage: updateResult.rows[0].profile_image,
          createdAt: updateResult.rows[0].created_at
        }
      });
    } catch (dbError) {
      console.error('Database error updating profile picture:', dbError);
      return res.status(500).json({ message: 'Database error: ' + dbError.message });
    }
    
  } catch (error) {
    console.error('Profile picture update error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

module.exports = router;