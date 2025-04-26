// server/server.js

const cluster = require('cluster');
const os      = require('os');
const numCPUs = os.cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is starting ${numCPUs} workers...`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
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
}

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

app.listen(PORT, () => {
  console.log(`Worker ${process.pid} listening on port ${PORT}`);
});