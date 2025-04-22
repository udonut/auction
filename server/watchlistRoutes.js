const express = require('express');
const router = express.Router();
const pool = require('./db');
const authMiddleware = require('./middleware/auth');

/**
 * Add item to watchlist
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { auctionId } = req.body;
    const userId = req.user.id;
    
    if (!auctionId) {
      return res.status(400).json({ message: 'Auction ID is required' });
    }
    
    // Check if auction exists
    const auctionResult = await pool.query(
      'SELECT * FROM auctions WHERE id = $1',
      [auctionId]
    );
    
    if (auctionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Auction not found' });
    }
    
    // Check if already in watchlist (prevent duplicates)
    const existingResult = await pool.query(
      'SELECT * FROM watchlist WHERE user_id = $1 AND auction_id = $2',
      [userId, auctionId]
    );
    
    if (existingResult.rows.length > 0) {
      return res.status(400).json({ message: 'Item already in watchlist' });
    }
    
    // Add to watchlist
    const result = await pool.query(
      'INSERT INTO watchlist (user_id, auction_id) VALUES ($1, $2) RETURNING *',
      [userId, auctionId]
    );
    
    res.status(201).json({
      message: 'Item added to watchlist',
      watchlistItem: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Remove item from watchlist
 */
router.delete('/:auctionId', authMiddleware, async (req, res) => {
  try {
    const { auctionId } = req.params;
    const userId = req.user.id;
    
    const result = await pool.query(
      'DELETE FROM watchlist WHERE user_id = $1 AND auction_id = $2 RETURNING *',
      [userId, auctionId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Item not found in watchlist' });
    }
    
    res.json({
      message: 'Item removed from watchlist',
      watchlistItem: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Check if item is in watchlist
 */
router.get('/check/:auctionId', authMiddleware, async (req, res) => {
  try {
    const { auctionId } = req.params;
    const userId = req.user.id;
    
    const result = await pool.query(
      'SELECT * FROM watchlist WHERE user_id = $1 AND auction_id = $2',
      [userId, auctionId]
    );
    
    res.json({
      inWatchlist: result.rows.length > 0
    });
    
  } catch (error) {
    console.error('Error checking watchlist:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Get user's watchlist
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search; // Add search parameter
    
    // Modify count query to include search if present
    let countQuery = 'SELECT COUNT(*) FROM watchlist w JOIN auctions a ON w.auction_id = a.id WHERE w.user_id = $1';
    let countParams = [userId];
    
    if (search) {
      countQuery += ' AND (a.title ILIKE $2 OR a.description ILIKE $2)';
      countParams.push(`%${search}%`);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);
    
    // Modify items query to include search
    let query = `
      SELECT w.id, w.created_at, a.id as auction_id, a.title, a.images, 
              a.starting_price, a.current_bid, a.ends_at, 
              (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) as bid_count
       FROM watchlist w
       JOIN auctions a ON w.auction_id = a.id
       WHERE w.user_id = $1
    `;
    
    let queryParams = [userId];
    
    if (search) {
      query += ' AND (a.title ILIKE $2 OR a.description ILIKE $2)';
      queryParams.push(`%${search}%`);
    }
    
    query += ' ORDER BY w.created_at DESC LIMIT $' + (queryParams.length + 1) + ' OFFSET $' + (queryParams.length + 2);
    queryParams.push(limit, offset);
    
    const result = await pool.query(query, queryParams);
    
    res.json({
      watchlist: result.rows.map(item => ({
        id: item.id,
        auctionId: item.auction_id,
        title: item.title,
        image: item.images && item.images.length > 0 ? item.images[0] : null,
        startingPrice: item.starting_price,
        currentBid: item.current_bid || item.starting_price,
        endsAt: item.ends_at,
        bidCount: item.bid_count,
        addedAt: item.created_at
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    });
    
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;