const express = require('express');
const cors = require('cors');
const authRoutes = require('./authRoutes');
const auctionRoutes = require('./auctionRoutes');
const authMiddleware = require('./middleware/auth'); // Add this if creating middleware
const rateLimit = require('express-rate-limit'); // Add rate limiting
// Add this line after requiring your other routes
const bidRoutes = require('./bidRoutes');
// Add this line with your other route imports
const watchlistRoutes = require('./watchlistRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Update your CORS configuration
const corsOptions = {
  origin: '*', // In production, specify your frontend domain
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'x-auth-token']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Add this right after app.use(express.json())
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Create a limiter for auction creation
const auctionLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 100, 
  message: 'Too many auctions created from this IP, please try again after an hour'
});

// Modify your existing rate limiter or add these new ones

// Create a general limiter
const generalLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});

// Create a more generous limiter for admin routes
const adminLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 100, 
  message: 'Too many admin requests from this IP, please try again later'
});

// Routes
app.use('/api/auth', authRoutes);
// Add this before your existing routes
app.use('/api/bids', bidRoutes);
// Add this with your other route registrations
app.use('/api/watchlist', watchlistRoutes);
// Reorder these routes - specific routes should come before general ones
app.use('/api/auctions/admin', adminLimiter); // Admin routes first
app.use('/api/auctions', auctionLimiter);
app.use('/api/auctions', auctionRoutes); // Move this right after the limiters
app.use('/api', generalLimiter); // General limiter last

// Protected routes example (if needed)
// app.use('/api/protected', authMiddleware, protectedRoutes);

// Basic route for testing
app.get('/', (req, res) => {
  res.send('BidMaster API is running');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});