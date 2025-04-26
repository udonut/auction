const cluster = require('cluster');
const os = require('os');
const numCPUs = os.cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is starting ${numCPUs} workers...`);
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died. Spawning a new worker...`);
    cluster.fork();
  });

  return;
}

const express = require('express');
const cors = require('cors');
const authRoutes = require('./authRoutes');
const auctionRoutes = require('./auctionRoutes');
const authMiddleware = require('./middleware/auth');
const rateLimit = require('express-rate-limit');
const bidRoutes = require('./bidRoutes');
const watchlistRoutes = require('./watchlistRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
const corsOptions = {
  origin: '*', // In production, restrict to your frontend domain
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'x-auth-token']
};

// Global middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Rate limiters
const auctionLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 100,
  message: 'Too many auctions created from this IP, please try again after an hour'
});

const adminLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 100,
  message: 'Too many admin requests from this IP, please try again later'
});

const generalLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later'
});

// Route registrations
app.use('/api/auth', authRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/auctions/admin', adminLimiter);
app.use('/api/auctions', auctionLimiter);
app.use('/api/auctions', auctionRoutes);
app.use('/api', generalLimiter);

// Test route
app.get('/', (req, res) => {
  res.send('BidMaster API is running');
});

// Start server
app.listen(PORT, () => {
  console.log(`Worker ${process.pid} listening on port ${PORT}`);
});