const express = require('express');
const router = express.Router();
const pool = require('./db');
const authMiddleware = require('./middleware/auth');

/**
 * Place a new bid
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { auctionId, amount } = req.body;
    const userId = req.user.id;
    
    console.log('Received bid request:', { auctionId, amount, userId });
    
    if (!auctionId || !amount) {
      return res.status(400).json({ message: 'Auction ID and amount are required' });
    }
    
    // Validate that the amount is a valid number
    const bidAmount = parseFloat(amount);
    if (isNaN(bidAmount) || bidAmount <= 0) {
      return res.status(400).json({ message: 'Bid amount must be a positive number' });
    }
    
    // Check if auction exists and is active
    const auctionResult = await pool.query(
      'SELECT * FROM auctions WHERE id = $1',
      [auctionId]
    );
    
    if (auctionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Auction not found' });
    }
    
    const auction = auctionResult.rows[0];
    
    if (auction.status !== 'active') {
      return res.status(400).json({ message: 'Cannot bid on inactive auction' });
    }
    
    if (new Date(auction.ends_at) < new Date()) {
      return res.status(400).json({ message: 'Auction has ended' });
    }
    
    // Check if seller is trying to bid on their own auction
    if (auction.seller_id === userId) {
      return res.status(400).json({ message: 'You cannot bid on your own auction' });
    }
    
    // Get the current highest bid
    const highestBidResult = await pool.query(
      'SELECT MAX(amount) as highest_bid FROM bids WHERE auction_id = $1',
      [auctionId]
    );
    
    const currentHighestBid = highestBidResult.rows[0].highest_bid || 0;
    const minBidAmount = Math.max(auction.starting_price, currentHighestBid + 1);
    
    if (bidAmount < minBidAmount) {
      return res.status(400).json({ 
        message: `Bid must be at least €${minBidAmount.toFixed(2)}`,
        minBidAmount: minBidAmount
      });
    }
    
    // Begin a transaction with better error handling
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      console.log('Transaction started');
      
      // Mark all previous bids as outbid
      await client.query(
        'UPDATE bids SET status = $1 WHERE auction_id = $2 AND status = $3',
        ['outbid', auctionId, 'active']
      );
      
      console.log('Previous bids marked as outbid');
      
      // Insert the new bid
      const newBidResult = await client.query(
        'INSERT INTO bids (auction_id, user_id, amount, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [auctionId, userId, bidAmount, 'active']
      );
      
      console.log('New bid inserted:', newBidResult.rows[0]);
      
      // Update the current_bid and bid_count in auctions table
      try {
        // Try to update using current_bid
        await client.query(
          'UPDATE auctions SET current_bid = $1, bid_count = (SELECT COUNT(*) FROM bids WHERE auction_id = $2) WHERE id = $2',
          [bidAmount, auctionId]
        );
      } catch (columnError) {
        // If it fails because the column doesn't exist, only update what we can
        console.warn('Could not update current_bid - column may not exist:', columnError.message);
        
        // Try to update only bid_count or skip this step entirely
        try {
          await client.query(
            'UPDATE auctions SET bid_count = (SELECT COUNT(*) FROM bids WHERE auction_id = $1) WHERE id = $1',
            [auctionId]
          );
        } catch (bidCountError) {
          console.warn('Could not update bid_count either:', bidCountError.message);
          // Continue without updating the auctions table
        }
      }
      
      console.log('Auction updated with new bid amount');
      
      await client.query('COMMIT');
      console.log('Transaction committed successfully');
      
      // Get user info
      const userResult = await pool.query(
        'SELECT id, full_name FROM users WHERE id = $1',
        [userId]
      );
      
      const bid = {
        ...newBidResult.rows[0],
        user: {
          id: userResult.rows[0].id,
          fullName: userResult.rows[0].full_name
        }
      };
      
      res.status(201).json({
        message: 'Bid placed successfully',
        bid: bid
      });
      
    } catch (innerError) {
      await client.query('ROLLBACK');
      console.error('Database transaction error:', innerError);
      // Throw with more details to be caught by outer catch
      throw new Error(`Transaction failed: ${innerError.message}`);
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error placing bid:', error);
    res.status(500).json({ 
      message: 'Server error processing bid', 
      details: error.message 
    });
  }
});

/**
 * Get all bids for an auction
 */
router.get('/auctions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const bidsResult = await pool.query(
      `SELECT b.id, b.amount, b.created_at, b.status, 
       u.id as user_id, u.full_name as user_name
       FROM bids b
       JOIN users u ON b.user_id = u.id
       WHERE b.auction_id = $1
       ORDER BY b.created_at DESC`,
      [id]
    );
    
    res.json({
      auctionId: id,
      bids: bidsResult.rows.map(row => ({
        id: row.id,
        amount: row.amount,
        createdAt: row.created_at,
        status: row.status,
        user: {
          id: row.user_id,
          name: row.user_name
        }
      }))
    });
    
  } catch (error) {
    console.error('Error fetching auction bids:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Get current user's bids
 */
router.get('/my-bids', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status; // 'active', 'won', 'lost', 'watchlist'
    const search = req.query.search;
    
    // Build query based on status
    let queryParams = [userId];
    let queryConditions = 'b.user_id = $1';
    let countConditions = 'b.user_id = $1';
    
    // Add status conditions with CORRECTED "won" logic
    if (status === 'active') {
      queryConditions += ' AND a.ends_at > NOW() AND (b.status = \'active\' OR b.id = (SELECT MAX(id) FROM bids WHERE auction_id = a.id AND user_id = $1))';
      countConditions += ' AND a.ends_at > NOW() AND (b.status = \'active\' OR b.id = (SELECT MAX(id) FROM bids WHERE auction_id = a.id AND user_id = $1))';
    } else if (status === 'won') {
      // An auction is only "won" if:
      // 1. It has status 'ended' AND the user is the highest bidder, OR
      // 2. It has a buyer_id set to this user
      queryConditions += ' AND ((a.status = \'ended\' AND b.id = (SELECT MAX(id) FROM bids WHERE auction_id = a.id)) OR a.buyer_id = $1)';
      countConditions += ' AND ((a.status = \'ended\' AND b.id = (SELECT MAX(id) FROM bids WHERE auction_id = a.id)) OR a.buyer_id = $1)';
    } else if (status === 'lost') {
      // Updated "lost" logic to match new "won" criteria:
      // 1. Auction has ended (time elapsed)
      // 2. User is NOT the buyer
      // 3. Either auction status is not 'ended' OR user is not the highest bidder
      queryConditions += ' AND a.ends_at <= NOW() AND (a.buyer_id IS NULL OR a.buyer_id != $1) AND (a.status != \'ended\' OR b.id != (SELECT MAX(id) FROM bids WHERE auction_id = a.id))';
      countConditions += ' AND a.ends_at <= NOW() AND (a.buyer_id IS NULL OR a.buyer_id != $1) AND (a.status != \'ended\' OR b.id != (SELECT MAX(id) FROM bids WHERE auction_id = a.id))';
    } else if (status === 'watchlist') {
      // This remains unchanged
      queryConditions += ' AND EXISTS (SELECT 1 FROM watchlist w WHERE w.user_id = $1 AND w.auction_id = a.id)';
      countConditions += ' AND EXISTS (SELECT 1 FROM watchlist w WHERE w.user_id = $1 AND w.auction_id = a.id)';
    }
    
    // Add search condition if search term is provided
    if (search) {
      // Fix: Use the correct parameter index
      const searchParamIndex = queryParams.length + 1;
      queryParams.push(`%${search}%`);
      
      // Fix: Only search in fields that are guaranteed to exist
      queryConditions += ` AND (a.title ILIKE $${searchParamIndex})`;
      countConditions += ` AND (a.title ILIKE $${searchParamIndex})`;
      
      console.log('Added search condition with param index:', searchParamIndex);
    }
    
    // Create the main query and count query
    const query = `
      SELECT 
        b.id as bid_id, 
        b.amount, 
        b.created_at as bid_date, 
        b.status as bid_status,
        a.id as auction_id, 
        a.title, 
        a.images, 
        a.starting_price, 
        COALESCE(a.current_bid, a.starting_price) as current_bid,
        a.ends_at,
        (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) as bid_count,
        (SELECT MAX(amount) FROM bids WHERE auction_id = a.id) as highest_bid
      FROM bids b
      JOIN auctions a ON b.auction_id = a.id
      WHERE ${queryConditions}
      ORDER BY b.created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;
    
    const countQuery = `
      SELECT COUNT(DISTINCT a.id) as total
      FROM bids b
      JOIN auctions a ON b.auction_id = a.id
      WHERE ${countConditions}
    `;
    
    // Add pagination parameters
    queryParams.push(limit, offset);
    
    // Log the queries for debugging
    console.log('Count query:', countQuery, 'with params:', queryParams.slice(0, -2));
    console.log('Main query:', query, 'with params:', queryParams);
    
    // Execute queries
    const countResult = await pool.query(countQuery, queryParams.slice(0, -2));
    const bidsResult = await pool.query(query, queryParams);
    const total = parseInt(countResult.rows[0].total || '0');
    
    // Group by auction to avoid duplicates
    const auctionMap = {};
    bidsResult.rows.forEach(row => {
      if (!auctionMap[row.auction_id]) {
        auctionMap[row.auction_id] = {
          auctionId: row.auction_id,
          title: row.title,
          image: row.images && row.images.length > 0 ? row.images[0] : null,
          startingPrice: row.starting_price,
          currentBid: row.current_bid || row.starting_price,
          highestBid: row.highest_bid || row.current_bid || row.starting_price,
          endsAt: row.ends_at,
          bidCount: row.bid_count || 0,
          userBid: {
            bidId: row.bid_id,
            amount: row.amount,
            date: row.bid_date,
            status: row.bid_status
          },
          status: new Date(row.ends_at) > new Date() ? 'active' : 
                  (row.highest_bid === row.amount ? 'won' : 'lost')
        };
      }
    });
    
    // Convert map to array
    const bids = Object.values(auctionMap);
    
    res.json({
      bids,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1, // Ensure at least 1 page
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    });
    
  } catch (error) {
    console.error('Error fetching user bids:', error);
    res.status(500).json({ message: 'Server error', details: error.message });
  }
});

// Add this new endpoint to get all counts at once
router.get('/counts', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get active bids count
    const activeBidsQuery = `
      SELECT COUNT(DISTINCT a.id) as count
      FROM bids b
      JOIN auctions a ON b.auction_id = a.id
      WHERE b.user_id = $1 
      AND a.ends_at > NOW() 
      AND (b.status = 'active' OR b.id = (SELECT MAX(id) FROM bids WHERE auction_id = a.id AND user_id = $1))
    `;
    
    // Updated won auctions count to EXACTLY match our criteria from /my-bids endpoint
    const wonAuctionsQuery = `
      SELECT COUNT(DISTINCT a.id) as count
      FROM bids b
      JOIN auctions a ON b.auction_id = a.id
      WHERE b.user_id = $1 
      AND ((a.status = 'ended' AND b.id = (SELECT MAX(id) FROM bids WHERE auction_id = a.id)) 
           OR a.buyer_id = $1)
    `;
    
    // Get watchlist count
    const watchlistQuery = `
      SELECT COUNT(*) as count
      FROM watchlist w
      WHERE w.user_id = $1
    `;
    
    // Run all queries in parallel for efficiency
    const [activeBidsResult, wonAuctionsResult, watchlistResult] = await Promise.all([
      pool.query(activeBidsQuery, [userId]),
      pool.query(wonAuctionsQuery, [userId]),
      pool.query(watchlistQuery, [userId])
    ]);
    
    res.json({
      activeBids: parseInt(activeBidsResult.rows[0]?.count || 0),
      wonAuctions: parseInt(wonAuctionsResult.rows[0]?.count || 0),
      watchlist: parseInt(watchlistResult.rows[0]?.count || 0)
    });
    
  } catch (error) {
    console.error('Error fetching bid counts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;