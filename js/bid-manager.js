/**
 * Bid manager for handling bid-related functionality
 */
document.addEventListener('DOMContentLoaded', function() {
  // API URL
  const API_URL = 'http://localhost:5000/api';
  
  // Get token from local storage
  const token = localStorage.getItem('token');
  
  // Initialize bid form if present on the page
  const bidForm = document.getElementById('bid-form');
  if (bidForm) {
    initBidForm(bidForm);
  }
  
  // Initialize bid history if present on the page
  const bidHistoryContainer = document.getElementById('bid-history');
  if (bidHistoryContainer) {
    const auctionId = getAuctionIdFromUrl();
    if (auctionId) {
      loadBidHistory(auctionId, bidHistoryContainer);
    }
  }
  
  /**
   * Initialize the bid form with event listeners
   * @param {HTMLElement} form - The bid form element
   */
  function initBidForm(form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      if (!token) {
        showLoginPrompt();
        return;
      }
      
      const bidAmount = document.getElementById('bid-amount').value;
      const auctionId = document.getElementById('auction-id').value;
      const minBid = parseFloat(document.getElementById('min-bid').value);
      
      // Basic validation
      if (!bidAmount || isNaN(parseFloat(bidAmount))) {
        showBidError('Please enter a valid bid amount');
        return;
      }
      
      if (parseFloat(bidAmount) < minBid) {
        showBidError(`Your bid must be at least €${minBid.toFixed(2)}`);
        return;
      }
      
      try {
        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';
        
        const response = await fetch(`${API_URL}/bids`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token
          },
          body: JSON.stringify({
            auctionId: auctionId,
            amount: bidAmount
          })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Failed to place bid');
        }
        
        // Reset form and show success
        form.reset();
        showBidSuccess('Your bid was placed successfully!');
        
        // Update UI with the new bid
        updateBidUI(data.bid);
        
        // Refresh bid history if it exists on the page
        if (bidHistoryContainer) {
          loadBidHistory(auctionId, bidHistoryContainer);
        }
        
      } catch (error) {
        console.error('Error placing bid:', error);
        showBidError(error.message || 'Failed to place bid. Please try again.');
      } finally {
        // Restore button state
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    });
  }
  
  /**
   * Show login prompt for users who aren't logged in
   */
  function showLoginPrompt() {
    const container = document.querySelector('.bid-container');
    
    if (!container) return;
    
    // Create login prompt
    const loginPrompt = document.createElement('div');
    loginPrompt.className = 'login-prompt';
    loginPrompt.innerHTML = `
      <p>You must be logged in to place a bid.</p>
      <a href="login.html?redirect=${encodeURIComponent(window.location.href)}" class="btn-primary">Log In</a>
      <a href="register.html?redirect=${encodeURIComponent(window.location.href)}" class="btn-secondary">Register</a>
    `;
    
    // Replace bid form with login prompt
    container.innerHTML = '';
    container.appendChild(loginPrompt);
  }
  
  /**
   * Show bid success message
   * @param {string} message - Success message to display
   */
  function showBidSuccess(message) {
    const successEl = document.getElementById('bid-success');
    if (successEl) {
      successEl.textContent = message;
      successEl.style.display = 'block';
      
      // Hide after 5 seconds
      setTimeout(() => {
        successEl.style.display = 'none';
      }, 5000);
    }
  }
  
  /**
   * Show bid error message
   * @param {string} message - Error message to display
   */
  function showBidError(message) {
    const errorEl = document.getElementById('bid-error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
      
      // Hide after 5 seconds
      setTimeout(() => {
        errorEl.style.display = 'none';
      }, 5000);
    }
  }
  
  /**
   * Update UI elements with new bid information
   * @param {Object} bid - The new bid object
   */
  function updateBidUI(bid) {
    // Update current bid display if it exists
    const currentBidEl = document.getElementById('current-bid');
    if (currentBidEl) {
      currentBidEl.textContent = `€${parseFloat(bid.amount).toFixed(2)}`;
    }
    
    // Update bid count if it exists
    const bidCountEl = document.getElementById('bid-count');
    if (bidCountEl) {
      const currentCount = parseInt(bidCountEl.textContent) || 0;
      bidCountEl.textContent = (currentCount + 1).toString();
    }
    
    // Update minimum bid amount
    const minBidEl = document.getElementById('min-bid');
    if (minBidEl) {
      minBidEl.value = (parseFloat(bid.amount) + 1).toFixed(2);
    }
    
    // Update bid amount input placeholder
    const bidAmountEl = document.getElementById('bid-amount');
    if (bidAmountEl) {
      bidAmountEl.placeholder = `€${(parseFloat(bid.amount) + 1).toFixed(2)} or more`;
    }
  }
  
  /**
   * Load bid history for an auction
   * @param {string|number} auctionId - The auction ID
   * @param {HTMLElement} container - Container to render bid history
   */
  async function loadBidHistory(auctionId, container) {
    try {
      container.innerHTML = '<p class="loading-text">Loading bid history...</p>';
      
      const response = await fetch(`${API_URL}/bids/auctions/${auctionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token || '' // Optional for public endpoint
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load bid history');
      }
      
      const data = await response.json();
      
      if (data.bids.length === 0) {
        container.innerHTML = '<p class="no-bids-message">No bids yet. Be the first to bid!</p>';
        return;
      }
      
      // Render bid history
      const bidHistoryHTML = `
        <h3>Bid History (${data.bids.length} bids)</h3>
        <table class="bid-history-table">
          <thead>
            <tr>
              <th>Bidder</th>
              <th>Amount</th>
              <th>Date & Time</th>
            </tr>
          </thead>
          <tbody>
            ${data.bids.map(bid => `
              <tr class="${isCurrentUser(bid.user.id) ? 'user-bid' : ''}">
                <td>${formatBidder(bid.user.name, bid.user.id)}</td>
                <td>€${parseFloat(bid.amount).toFixed(2)}</td>
                <td>${formatDate(new Date(bid.createdAt))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      
      container.innerHTML = bidHistoryHTML;
      
    } catch (error) {
      console.error('Error loading bid history:', error);
      container.innerHTML = '<p class="error-message">Failed to load bid history. Please try again later.</p>';
    }
  }
  
  /**
   * Format bidder name, highlighting the current user
   * @param {string} name - Bidder's name
   * @param {string|number} userId - Bidder's user ID
   * @returns {string} Formatted bidder display
   */
  function formatBidder(name, userId) {
    // Get current user data
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (user.id === userId) {
      return `${name} (You)`;
    }
    
    // Mask the name to maintain some privacy
    // Return first character + asterisks + last character
    if (name) {
      if (name.length <= 2) {
        return name;
      }
      return `${name.charAt(0)}${'*'.repeat(name.length - 2)}${name.charAt(name.length - 1)}`;
    }
    
    return 'Anonymous Bidder';
  }
  
  /**
   * Check if a user ID matches the current logged-in user
   * @param {string|number} userId - User ID to check
   * @returns {boolean} True if it's the current user
   */
  function isCurrentUser(userId) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.id === userId;
  }
  
  /**
   * Format date for display
   * @param {Date} date - Date to format
   * @returns {string} Formatted date string
   */
  function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }
  
  /**
   * Get auction ID from URL query parameters
   * @returns {string|null} The auction ID or null
   */
  function getAuctionIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
  }
});