require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const adminAuthRouter = require('./routes/adminAuth');

const app = express();

// allow your admin UI (served e.g. from http://127.0.0.1:5500 or http://localhost:5000)
app.use(cors({
  origin: [
    'http://127.0.0.1:5500',
    'http://localhost:5000'
  ],
  methods: ['GET','POST'],
  allowedHeaders: ['Content-Type','x-auth-token']
}));

app.use(express.json());

// all routes under /admin/* are handled by the router below
app.use('/admin', adminAuthRouter);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🔐 Auth service listening on ${PORT}`));