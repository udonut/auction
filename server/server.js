// auction/server.js
require('dotenv').config();          // loads auction/.env
const cluster = require('cluster');
const os      = require('os');
const grpc    = require('@grpc/grpc-js');
const numCPUs = os.cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is starting ${numCPUs} workers…`);

  // graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Master received SIGTERM. Shutting down workers…');
    for (const id in cluster.workers) {
      cluster.workers[id].send({ cmd: 'shutdown' });
    }
    setTimeout(() => process.exit(0), 30000);
  });

  // respawn dead workers with the same env
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died. Spawning replacement…`);
    cluster.fork(worker.env);
  });

  // ─── fork background ─────────────────────
  cluster.fork({
    ...process.env,
    WORKER_TYPE: 'background'
  });

  // ─── fork API workers (force PORT=5000) ──
  for (let i = 1; i < numCPUs; i++) {
    cluster.fork({
      ...process.env,
      WORKER_TYPE: 'api',
      PORT: '5000'
    });
  }

  // ─── your gRPC server here (unchanged) ────
  const messages = require('./proto/auction_pb');
  const services = require('./proto/auction_grpc_pb');
  const pool     = require('./db');

  function listAuctions(call, cb) { /* … */ }
  function getAuction(call, cb) { /* … */ }
  function placeBid(call, cb) { /* … */ }

  const grpcServer = new grpc.Server();
  grpcServer.addService(services.AuctionServiceService, {
    listAuctions,
    getAuction,
    placeBid
  });
  grpcServer.bindAsync(
    '0.0.0.0:50051',
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) throw err;
      console.log(`✅ gRPC server listening on ${port}`);
    }
  );
  return;
}

// ─── BACKGROUND ─────────────────────────────
if (process.env.WORKER_TYPE === 'background') {
  console.log(`Background worker ${process.pid} started`);
  const pool = require('./db');
  setInterval(async () => {
    try {
      await pool.query(`
        UPDATE auctions
           SET status = 'ended'
         WHERE status = 'active'
           AND ends_at < NOW()
      `);
      console.log('Background: expired auctions updated');
    } catch (err) {
      console.error('Background worker error:', err);
    }
  }, 60_000);
  return;
}

// ─── API WORKER ──────────────────────────────
const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const authRoutes = require('./authRoutes');
const auctionRoutes   = require('./auctionRoutes');
const bidRoutes       = require('./bidRoutes');
const watchlistRoutes = require('./watchlistRoutes');

const app  = express();
const PORT = process.env.PORT || 5000;

// CORS + JSON parser
app.use(cors({
  origin: [
    'http://127.0.0.1:5500',
    'http://localhost:5000'
  ],
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','x-auth-token']
}));
app.use(express.json());

// Rate-limit all /api routes
app.use(
  '/api',
  rateLimit({ windowMs: 120_000, max: 100 })
);

// Mount routers
app.use('/api/auth',      authRoutes);
app.use('/api/bids',      bidRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/auctions',  auctionRoutes);

// Health-check
app.get('/', (req, res) => res.send('BidMaster API is running'));

const server = app.listen(PORT, () => {
  console.log(`API Worker ${process.pid} listening on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('message', (msg) => {
  if (msg.cmd === 'shutdown') {
    console.log(`Worker ${process.pid} shutting down…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 15_000);
  }
});
