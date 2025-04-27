// server/server.js

const cluster = require('cluster');
const os      = require('os');
const numCPUs = os.cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is starting ${numCPUs} workers...`);

  // Add graceful shutdown handler
  process.on('SIGTERM', () => {
    console.log('Master received SIGTERM. Graceful shutdown initiated...');
    
    // Notify all workers to stop accepting new connections
    for (const id in cluster.workers) {
      cluster.workers[id].send({ command: 'shutdown' });
    }
    
    // Give workers time to finish current requests, then force shutdown
    setTimeout(() => {
      console.log('Forcing shutdown of remaining workers...');
      process.exit(0);
    }, 30000); // 30 second grace period
  });

  // Add a message handler for worker communication
  const workerStates = new Map();
  
  cluster.on('message', (worker, message) => {
    // Store worker state
    workerStates.set(worker.id, {
      ...message,
      lastUpdate: Date.now()
    });
    
    // Log important events
    if (message.type === 'alert' || message.type === 'error') {
      console.log(`Worker ${worker.id} reported ${message.type}: ${message.content}`);
    }
  });

  // Create a specialized worker for background tasks
  const backgroundWorker = cluster.fork({ WORKER_TYPE: 'background' });
  
  // Create regular API workers
  for (let i = 1; i < numCPUs; i++) {
    cluster.fork({ WORKER_TYPE: 'api' });
  }

  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died. Spawning a new one...`);
    cluster.fork();
  });

  const path        = require('path');
  const grpc        = require('@grpc/grpc-js');
  const messages    = require('./proto/auction_pb');
  const services    = require('./proto/auction_grpc_pb');
  const pool        = require('./db');

  function listAuctions(call, callback) {
    pool.query(
      `SELECT id, title, category, starting_price AS price, images, ends_at AS endsAt
         FROM auctions WHERE status='active'`
    ).then(res => {
      const reply = new messages.AuctionList();
      res.rows.forEach(row => {
        const auctionMsg = new messages.Auction();
        auctionMsg.setId(row.id);
        auctionMsg.setTitle(row.title);
        auctionMsg.setCategory(row.category);
        auctionMsg.setPrice(row.price);
        auctionMsg.setImagesList(row.images);
        auctionMsg.setEndsAt(row.endsat);
        reply.addAuctions(auctionMsg);
      });
      callback(null, reply);
    }).catch(err => {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    });
  }

  function getAuction(call, callback) {
    const { id } = call.request;
    pool.query('SELECT * FROM auctions WHERE id = $1', [id])
      .then(res => {
        if (!res.rows.length) {
          return callback({
            code: grpc.status.NOT_FOUND,
            message: `Auction ${id} not found`
          });
        }
        const row = res.rows[0];
        const msg = new messages.Auction();
        msg.setId(row.id);
        msg.setTitle(row.title);
        msg.setCategory(row.category);
        msg.setPrice(row.starting_price);
        msg.setImagesList(row.images);
        msg.setEndsAt(row.ends_at);
        callback(null, msg);
      })
      .catch(err => {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      });
  }

  function placeBid(call, callback) {
    const { auctionId, userId, amount } = call.request;
    pool.query(
      'INSERT INTO bids (auction_id,user_id,amount,status) VALUES($1,$2,$3,$4) RETURNING *',
      [auctionId, userId, amount, 'active']
    ).then(res => {
      const row = res.rows[0];
      const bidResp = new messages.BidResponse();
      bidResp.setId(row.id);
      bidResp.setAuctionId(row.auction_id);
      bidResp.setUserId(row.user_id);
      bidResp.setAmount(row.amount);
      bidResp.setStatus(row.status);
      bidResp.setCreatedAt(row.created_at.toISOString());
      callback(null, bidResp);
    }).catch(err => {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    });
  }

  const grpcServer = new grpc.Server();
  grpcServer.addService(
    services.AuctionServiceService,
    { listAuctions, getAuction, placeBid }
  );

  grpcServer.bindAsync(
    '0.0.0.0:50051',
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error('gRPC bind error:', err);
        process.exit(1);
      }
      grpcServer.start();
      console.log(`✅ gRPC listening on ${port}`);
    }
  );

  return;
} else {
  // Check worker type
  if (process.env.WORKER_TYPE === 'background') {
    console.log(`Background worker ${process.pid} started for handling auction scheduling, notifications, etc.`);
    
    // Background job for auction expiration check
    setInterval(async () => {
      try {
        // Check for expired auctions and update their status
        const pool = require('./db');
        await pool.query(`
          UPDATE auctions 
          SET status = 'ended' 
          WHERE status = 'active' AND ends_at < NOW()
        `);
        console.log('Background worker: Updated expired auctions');
      } catch (error) {
        console.error('Background worker error:', error);
      }
    }, 60000); // Run every minute
  } else {
    // Regular API worker
    const express         = require('express');
    const cors            = require('cors');
    const rateLimit       = require('express-rate-limit');
    const authRoutes      = require('./authRoutes');
    const auctionRoutes   = require('./auctionRoutes');
    const bidRoutes       = require('./bidRoutes');
    const watchlistRoutes = require('./watchlistRoutes');

    const app  = express();
    const PORT = process.env.PORT || 5000;

    app.use(cors({
      origin: '*',
      methods: ['GET','POST','PUT','DELETE'],
      allowedHeaders: ['Content-Type','x-auth-token']
    }));
    app.use(express.json());

    // rate limiters
    const auctionLimiter = rateLimit({ windowMs:120000, max:100 });
    const adminLimiter   = rateLimit({ windowMs:120000, max:100 });
    const generalLimiter = rateLimit({ windowMs:120000, max:100 });

    app.use('/api/auth',           authRoutes);
    app.use('/api/bids',           bidRoutes);
    app.use('/api/watchlist',      watchlistRoutes);
    app.use('/api/auctions/admin', adminLimiter);
    app.use('/api/auctions',       auctionLimiter);
    app.use('/api/auctions',       auctionRoutes);
    app.use('/api',                generalLimiter);

    app.get('/', (req, res) => res.send('BidMaster API is running'));

    const server = app.listen(PORT, () => {
      console.log(`Worker ${process.pid} listening on port ${PORT}`);
    });

    // In worker process, add periodic status reporting
    setInterval(() => {
      process.send({ 
        type: 'status',
        pid: process.pid,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        activeConnections: server._connections // Requires reference to your server
      });
    }, 30000); // Send status every 30 seconds

    // In worker process
    process.on('message', (msg) => {
      if (msg.command === 'shutdown') {
        console.log(`Worker ${process.pid} beginning graceful shutdown...`);
        
        // Stop accepting new connections
        server.close(() => {
          console.log(`Worker ${process.pid} has closed all connections.`);
          process.exit(0);
        });
        
        // Force shutdown after timeout in case connections don't close
        setTimeout(() => {
          console.log(`Worker ${process.pid} forcing exit.`);
          process.exit(0);
        }, 15000);
      }
    });
  }
}