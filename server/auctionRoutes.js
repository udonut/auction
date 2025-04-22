const express = require('express');
const router = express.Router();
const pool = require('./db');
const authMiddleware = require('./middleware/auth');
const adminAuth = require('./middleware/adminAuth');

// Add this validation function at the top of the file, after your requires
const validateImages = (images) => {
  if (!images || images.length === 0) {
    return ['https://res.cloudinary.com/demo/image/upload/samples/cloudinary-icon'];
  }
  return images;
};

/**
 * Get dashboard statistics - Admin only
 */
router.get('/admin/dashboard-stats', adminAuth, async (req, res) => {
  try {
    // Get pending verification count - simpler query
    const pendingVerificationResult = await pool.query(
      `SELECT COUNT(*) AS total FROM auctions WHERE status = 'pending_verification'`
    );
    
    // Get pending verification created yesterday
    const pendingYesterdayResult = await pool.query(
      `SELECT COUNT(*) AS yesterday FROM auctions 
       WHERE status = 'pending_verification' 
       AND created_at >= NOW() - INTERVAL '1 day'`
    );
    
    // Get active auctions count
    const activeAuctionsResult = await pool.query(
      `SELECT COUNT(*) AS total FROM auctions WHERE status = 'active'`
    );
    
    // Get count of auctions activated in the past week
    const weeklyActiveResult = await pool.query(
      `SELECT COUNT(*) AS weekly FROM auctions 
       WHERE status = 'active' 
       AND created_at >= NOW() - INTERVAL '7 days'`
    );
    
    // Extract values with safer parsing
    const pendingTotal = parseInt(pendingVerificationResult.rows[0].total || 0);
    const pendingYesterday = parseInt(pendingYesterdayResult.rows[0].yesterday || 0);
    const activeTotal = parseInt(activeAuctionsResult.rows[0].total || 0);
    const activeWeekly = parseInt(weeklyActiveResult.rows[0].weekly || 0);
    
    res.json({
      pendingVerification: {
        total: pendingTotal,
        change: pendingYesterday,
        changeLabel: 'since yesterday'
      },
      activeAuctions: {
        total: activeTotal,
        change: activeWeekly,
        changeLabel: 'this week'
      }
    });
    
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Get recent admin activities for dashboard
 */
router.get('/admin/recent-activities', adminAuth, async (req, res) => {
  try {
    // Get both auction activities and admin logins in one query with UNION
    const result = await pool.query(`
      -- Get auction verification activities
      SELECT 
        a.id AS auction_id,
        a.title AS auction_title,
        a.status,
        a.verified_at AS timestamp,
        admin.full_name AS admin_name,
        admin.id AS admin_id,
        'auction' AS activity_type
      FROM auctions a
      JOIN users admin ON a.verified_by = admin.id
      WHERE a.verified_at IS NOT NULL
      AND a.status IN ('active', 'rejected', 'more_info')
      
      UNION ALL
      
      -- Get admin logins from activity log
      SELECT 
        NULL AS auction_id,
        admin.email AS auction_title,
        'login' AS status,
        l.created_at AS timestamp,
        admin.full_name AS admin_name,
        admin.id AS admin_id,
        'login' AS activity_type
      FROM admin_activity_log l
      JOIN users admin ON l.admin_id = admin.id
      WHERE l.action_type = 'login'
      
      ORDER BY timestamp DESC
      LIMIT 10
    `);
    
    // Format the activities for frontend consumption
    const activities = result.rows.map(row => {
      let action, details, adminName;
      
      if (row.activity_type === 'auction') {
        if (row.status === 'active') action = 'Auction Approved';
        else if (row.status === 'rejected') action = 'Auction Rejected';
        else if (row.status === 'more_info') action = 'Auction More Info'; // Make sure this is explicit
        
        details = row.auction_title;
        adminName = row.admin_name;
      } else {
        action = 'Admin Login';
        details = row.auction_title; // Contains email for login activities
        adminName = row.admin_name;
      }
      
      return {
        time: row.timestamp,
        action: action,
        details: details,
        adminName: adminName,
        status: row.status,
        type: row.activity_type
      };
    });
    
    res.json(activities);
    
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Get auctions pending verification - Admin only (with pagination)
 */
router.get('/admin/verification', adminAuth, async (req, res) => {
  try {
    // Get pagination parameters from query string
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // Get recently decided auctions (within last 5 minutes) and pending ones
    const countResult = await pool.query(
      `SELECT COUNT(*) as total 
       FROM auctions a
       WHERE a.status = 'pending_verification'
       OR (a.verified_at >= NOW() - INTERVAL '5 minutes' 
           AND a.status IN ('active', 'rejected', 'more_info'))`
    );
    
    const total = parseInt(countResult.rows[0].total);
    
    // Get paginated auction data including recently decided ones
    const auctions = await pool.query(
      `SELECT a.*, u.full_name as seller_name
       FROM auctions a
       JOIN users u ON a.seller_id = u.id
       WHERE a.status = 'pending_verification'
       OR (a.verified_at >= NOW() - INTERVAL '5 minutes' 
           AND a.status IN ('active', 'rejected', 'more_info'))
       ORDER BY 
         CASE 
           WHEN a.status = 'pending_verification' THEN 0
           ELSE 1
         END,
         a.verified_at DESC NULLS LAST,
         a.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    // Send response with auctions and pagination metadata
    res.json({
      auctions: auctions.rows,
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
    console.error('Error fetching verification auctions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Get auction details by ID - Admin only
 */
router.get('/admin/:id', adminAuth, async (req, res) => {
  const auctionId = req.params.id;
  try {
    const result = await pool.query(
      `SELECT a.*, u.full_name AS seller_name, u.created_at AS seller_joined, u.profile_image AS seller_profile_image
       FROM auctions a
       JOIN users u ON a.seller_id = u.id
       WHERE a.id = $1`,
      [auctionId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Auction not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Update auction verification status - Admin only
 */
router.put('/admin/verify/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes, reason, message } = req.body;
    
    // Update auction status
    const result = await pool.query(
      `UPDATE auctions 
       SET status = $1, 
           admin_notes = $2, 
           rejection_reason = $3, 
           rejection_message = $4,
           verified_at = NOW(),
           verified_by = $5
       WHERE id = $6
       RETURNING *`,
      [status, adminNotes || null, reason || null, message || null, req.user.id, id]
    );
    
    res.json({
      message: 'Auction verification status updated',
      auction: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating auction verification:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new auction (protected route)
// The existing route can accept the image URLs directly
// Update the auction creation route to set all new auctions to pending_verification
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { 
      title, 
      category, 
      itemCondition, 
      description, 
      startingPrice,
      reservePrice,
      duration,
      shippingOptions,
      images
    } = req.body;
    
    // Get seller_id from authenticated user
    const sellerId = req.user.id;
    
    // Calculate end date
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + parseInt(duration));
    
    // Validate images before inserting
    const validatedImages = validateImages(images);
    
    // Insert new auction into database - explicitly set status to pending_verification
    const newAuction = await pool.query(
      `INSERT INTO auctions 
       (seller_id, title, category, item_condition, description, 
        starting_price, reserve_price, duration, shipping_options, ends_at, images, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        sellerId,
        title,
        category,
        itemCondition,
        description,
        startingPrice,
        reservePrice || null,
        duration,
        shippingOptions,
        endsAt,
        validatedImages, // Use the validated images instead of images || []
        'pending_verification'  // Explicitly set status
      ]
    );
    
    res.status(201).json({
      message: 'Auction created successfully and pending verification',
      auction: newAuction.rows[0]
    });
    
  } catch (error) {
    console.error('Error creating auction:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Get all active listings with pagination, sorting and filtering
 */
router.get('/listings', async (req, res) => {
  try {
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;
    
    // Get sorting parameter
    const sortBy = req.query.sort || 'ending-soon';
    
    // Get filter parameters
    const category = req.query.category ? req.query.category.split(',') : null;
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;
    const search = req.query.search || null;
    
    // SEPARATE PARAMETERS FOR COUNT QUERY
    let countQueryParams = [];
    let countQuery = `
      SELECT COUNT(*) as total
      FROM auctions a
      WHERE a.status = 'active' AND a.ends_at > NOW()
    `;
    
    // Add filters to count query if they exist
    if (category && category.length > 0) {
      countQuery += ` AND a.category = ANY($1)`;
      countQueryParams.push(category);
    }
    
    if (minPrice !== null) {
      const paramIndex = countQueryParams.length + 1;
      countQuery += ` AND a.starting_price >= $${paramIndex}`;
      countQueryParams.push(minPrice);
    }
    
    if (maxPrice !== null) {
      const paramIndex = countQueryParams.length + 1;
      countQuery += ` AND a.starting_price <= $${paramIndex}`;
      countQueryParams.push(maxPrice);
    }
    
    if (search) {
      const paramIndex = countQueryParams.length + 1;
      countQuery += ` AND (a.title ILIKE $${paramIndex} OR a.description ILIKE $${paramIndex} OR a.category ILIKE $${paramIndex})`;
      countQueryParams.push(`%${search}%`);
    }
    
    // Execute the count query with its parameters
    const countResult = await pool.query(countQuery, countQueryParams);
    const total = parseInt(countResult.rows[0].total);
    
    // SEPARATE QUERY AND PARAMETERS FOR MAIN QUERY
    let mainQueryParams = [];
    let mainQuery = `
      SELECT 
        a.id, 
        a.title, 
        a.category,
        a.starting_price,
        COALESCE(a.current_bid, a.starting_price) as current_bid,
        a.images,
        a.ends_at,
        (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) as bid_count
      FROM auctions a
      WHERE a.status = 'active' AND a.ends_at > NOW()
    `;
    
    // Add same filters to main query with fresh parameter indexing
    if (category && category.length > 0) {
      mainQuery += ` AND a.category = ANY($1)`;
      mainQueryParams.push(category);
    }
    
    if (minPrice !== null) {
      const paramIndex = mainQueryParams.length + 1;
      mainQuery += ` AND a.starting_price >= $${paramIndex}`;
      mainQueryParams.push(minPrice);
    }
    
    if (maxPrice !== null) {
      const paramIndex = mainQueryParams.length + 1;
      mainQuery += ` AND a.starting_price <= $${paramIndex}`;
      mainQueryParams.push(maxPrice);
    }
    
    if (search) {
      // Process the search string:
      // 1. Convert to lowercase
      // 2. Replace hyphens with spaces
      // 3. Split into individual words
      // 4. Filter out empty strings and very short words (like "a", "of", etc.)
      const processedSearch = search.toLowerCase().replace(/[-_]/g, ' ');
      const searchTerms = processedSearch.split(/\s+/)
        .filter(term => term.length > 2) // Skip very short words
        .map(term => term.trim())
        .filter(term => term);
      
      // If we have search terms after processing
      if (searchTerms.length > 0) {
        // Start the search condition
        mainQuery += ` AND (`;
        
        // For each search term, create a condition that matches it in title, description, or category
        const searchConditions = searchTerms.map(term => {
          // Add wildcards for partial matching - handles plural forms and word variations
          const paramIndex = mainQueryParams.length + 1;
          mainQueryParams.push(`%${term}%`);
          
          return `(a.title ILIKE $${paramIndex} OR a.description ILIKE $${paramIndex} OR a.category ILIKE $${paramIndex})`;
        });
        
        // Join the conditions with OR operator - any term can match
        mainQuery += searchConditions.join(' OR ');
        
        // Close the search condition
        mainQuery += `)`;
      }
    }
    
    // Add sorting
    switch(sortBy) {
      case 'ending-soon':
        mainQuery += ` ORDER BY a.ends_at ASC`;
        break;
      case 'newest':
        mainQuery += ` ORDER BY a.created_at DESC`;
        break;
      case 'price-low': 
        mainQuery += ` ORDER BY a.starting_price ASC`;
        break;
      case 'price-high':
        mainQuery += ` ORDER BY a.starting_price DESC`;
        break;
      case 'bids':
        // Sort by bid count (descending)
        mainQuery += ` ORDER BY (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) DESC`;
        break;
      default:
        mainQuery += ` ORDER BY a.ends_at ASC`;
    }
    
    // Add pagination
    const limitIndex = mainQueryParams.length + 1;
    const offsetIndex = mainQueryParams.length + 2;
    mainQuery += ` LIMIT $${limitIndex} OFFSET $${offsetIndex}`;
    mainQueryParams.push(limit, offset);
    
    // Log the final queries for debugging
    console.log('Count Query:', countQuery, countQueryParams);
    console.log('Main Query:', mainQuery, mainQueryParams);
    
    // Execute main query
    const result = await pool.query(mainQuery, mainQueryParams);
    
    // Send the response
    res.json({
      listings: result.rows.map(row => ({
        ...row,
        current_bid: row.current_bid || row.starting_price,
        bid_count: parseInt(row.bid_count) || 0  // Convert to integer and default to 0 if null
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
    console.error('Error fetching listings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Get random active listings for the homepage
 */
router.get('/random-active', async (req, res) => {
  try {
    // Get limit parameter, default to 12
    const limit = parseInt(req.query.limit) || 12;
    
    // Get random active auctions
    const query = `
      SELECT 
        a.id, 
        a.title, 
        a.category,
        a.starting_price,
        COALESCE(a.current_bid, a.starting_price) as current_bid,
        a.images,
        a.ends_at,
        (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) as bid_count
      FROM auctions a
      WHERE a.status = 'active' AND a.ends_at > NOW()
      ORDER BY RANDOM()
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    
    // Send the response
    res.json({
      listings: result.rows.map(row => ({
        ...row,
        current_bid: row.current_bid || row.starting_price,
        bid_count: parseInt(row.bid_count) || 0  // Convert to integer and default to 0
      }))
    });
    
  } catch (error) {
    console.error('Error fetching random listings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Get counts of active listings per category
 */
router.get('/category-counts', async (req, res) => {
  try {
    // Query to get count of active auctions by category
    const query = `
      SELECT 
        category, 
        COUNT(*) as count 
      FROM auctions 
      WHERE status = 'active' AND ends_at > NOW() 
      GROUP BY category
    `;
    
    const result = await pool.query(query);
    
    // Format the response as an object with categories as keys
    const categoryCounts = {};
    result.rows.forEach(row => {
      categoryCounts[row.category] = parseInt(row.count);
    });
    
    res.json(categoryCounts);
    
  } catch (error) {
    console.error('Error fetching category counts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all auctions
router.get('/', async (req, res) => {
  try {
    // Get query parameters for filtering
    const { category, status } = req.query;
    
    // Base query
    let query = 'SELECT * FROM auctions';
    let values = [];
    let conditions = [];
    
    // Add filters if provided
    if (category) {
      conditions.push(`category = $${values.length + 1}`);
      values.push(category);
    }
    
    if (status) {
      conditions.push(`status = $${values.length + 1}`);
      values.push(status);
    }
    
    // Add WHERE clause if needed
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    // Add sorting
    query += ' ORDER BY created_at DESC';
    
    const auctions = await pool.query(query, values);
    
    res.json(auctions.rows);
    
  } catch (error) {
    console.error('Error fetching auctions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's auctions
router.get('/my-listings', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const auctions = await pool.query(
      'SELECT * FROM auctions WHERE seller_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    res.json(auctions.rows);
    
  } catch (error) {
    console.error('Error fetching user auctions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get count of active listings for the current user
router.get('/my-active-listings-count', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT COUNT(*) AS count FROM auctions WHERE seller_id = $1 AND status = 'active'`,
      [userId]
    );
    res.json({ activeListings: parseInt(result.rows[0].count, 10) });
  } catch (error) {
    console.error('Error fetching active listings count:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific auction
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const auction = await pool.query(
      'SELECT * FROM auctions WHERE id = $1',
      [id]
    );
    
    if (auction.rows.length === 0) {
      return res.status(404).json({ message: 'Auction not found' });
    }
    
    res.json(auction.rows[0]);
    
  } catch (error) {
    console.error('Error fetching auction:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * End auction early and sell to highest bidder
 */
router.put('/:id/sell-now', authMiddleware, async (req, res) => {
  try {
    const auctionId = req.params.id;
    const userId = req.user.id;

    // First check if the user is the owner of this auction
    const auctionResult = await pool.query(
      'SELECT * FROM auctions WHERE id = $1 AND seller_id = $2',
      [auctionId, userId]
    );

    if (auctionResult.rows.length === 0) {
      return res.status(403).json({ message: 'You are not authorized to end this auction' });
    }

    // Get the highest bid for this auction
    const highestBidResult = await pool.query(
      'SELECT b.amount, b.user_id FROM bids b WHERE b.auction_id = $1 ORDER BY b.amount DESC LIMIT 1',
      [auctionId]
    );

    if (highestBidResult.rows.length === 0) {
      return res.status(400).json({ message: 'No bids found on this auction' });
    }

    const highestBid = highestBidResult.rows[0];

    // Update the auction with final price, buyer_id, and end date (now)
    const updateResult = await pool.query(
      'UPDATE auctions SET final_price = $1, buyer_id = $2, ends_at = NOW(), status = $3 WHERE id = $4 RETURNING *',
      [highestBid.amount, highestBid.user_id, 'ended', auctionId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(500).json({ message: 'Failed to update auction' });
    }

    res.json({
      message: 'Auction ended successfully. Item has been sold to the highest bidder.',
      auction: updateResult.rows[0]
    });

  } catch (error) {
    console.error('Error ending auction early:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Relist an auction
 */
router.put('/:id/relist', authMiddleware, async (req, res) => {
  try {
    const auctionId = req.params.id;
    const userId = req.user.id;
    const { duration } = req.body;
    
    // Validate input
    if (!duration) {
      return res.status(400).json({ message: 'Duration is required' });
    }
    
    // Parse duration as integer
    const durationInt = parseInt(duration);
    if (isNaN(durationInt) || durationInt <= 0) {
      return res.status(400).json({ message: 'Invalid duration' });
    }
    
    // First check if the user is the owner of this auction
    const auctionResult = await pool.query(
      'SELECT * FROM auctions WHERE id = $1 AND seller_id = $2',
      [auctionId, userId]
    );
    
    if (auctionResult.rows.length === 0) {
      return res.status(403).json({ message: 'You are not authorized to relist this auction' });
    }
    
    // Calculate new end date
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + durationInt);
    
    // Update the auction with new dates and status
    const updateResult = await pool.query(
      'UPDATE auctions SET created_at = NOW(), ends_at = $1, status = $2, verified_at = NULL, verified_by = NULL WHERE id = $3 RETURNING *',
      [endsAt, 'pending_verification', auctionId]
    );
    
    if (updateResult.rows.length === 0) {
      return res.status(500).json({ message: 'Failed to relist auction' });
    }
    
    res.json({
      message: 'Auction relisted successfully and pending verification',
      auction: updateResult.rows[0]
    });
    
  } catch (error) {
    console.error('Error relisting auction:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const decoded = req.user;
    const userResult = await pool.query(
      'SELECT id, full_name, email, phone, about_me, profile_image, created_at, role FROM users WHERE id = $1',
      [decoded.id]
    );
    res.json({
      user: {
        id: userResult.rows[0].id,
        fullName: userResult.rows[0].full_name,
        email: userResult.rows[0].email,
        phone: userResult.rows[0].phone || '',
        aboutMe: userResult.rows[0].about_me || '',
        profileImage: userResult.rows[0].profile_image,
        createdAt: userResult.rows[0].created_at,
        role: userResult.rows[0].role // <-- add this line
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;