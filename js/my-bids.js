/**
 * My Bids page functionality
 */
document.addEventListener('DOMContentLoaded', function() {
  // API URL
  const API_URL = 'http://localhost:5000/api/bids';
  
  // Get token from local storage
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }
  
  // Elements
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.bids-content');
  const sortSelect = document.getElementById('sort-bids');
  const searchInput = document.querySelector('.search-container input');
  const searchButton = document.querySelector('.search-button');
  
  // Add reference to search results indicator
  const searchResultsIndicator = document.querySelector('.search-results-indicator');
  const searchTermDisplay = document.querySelector('.search-term');
  const clearSearchBtn = document.querySelector('.clear-search');
  
  // Current state
  let currentTab = 'active-bids';
  let currentSort = 'ending-soon';
  let currentPage = 1;
  let searchTerm = '';
  
  // Add this line to define the limit variable
  const itemsPerPage = 10; // Number of items to show per page

  // Set up tab switching
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');
      
      // Remove active class from all tabs
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked tab
      this.classList.add('active');
      document.getElementById(tabId).classList.add('active');
      
      // Clear search when switching tabs
      searchInput.value = '';
      searchTerm = '';
      if (searchResultsIndicator) {
        searchResultsIndicator.style.display = 'none';
      }
      
      // Update current tab and fetch bids
      currentTab = tabId;
      currentPage = 1;
      fetchBids();
    });
  });
  
  // Handle sort change
  if (sortSelect) {
    sortSelect.addEventListener('change', function() {
      currentSort = this.value;
      currentPage = 1; // Reset to page 1 when changing sort
      fetchBids();
    });
  }
  
  // Handle search
  if (searchButton) {
    searchButton.addEventListener('click', function() {
      performSearch();
    });
    
    searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        performSearch();
      }
    });
  }
  
  // Handle clear search button
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', function() {
      // Clear search term and input
      searchTerm = '';
      searchInput.value = '';
      
      // Hide search indicator
      if (searchResultsIndicator) {
        searchResultsIndicator.style.display = 'none';
      }
      
      // Reset to first page and reload
      currentPage = 1;
      fetchBids();
    });
  }
  
  // Initial fetch
  fetchBids();
  
  /**
   * Fetch user's bids from API
   */
  async function fetchBids() {
    try {
      // Get the active content container
      const activeContent = document.getElementById(currentTab);
      const itemsContainer = activeContent.querySelector('.bid-items');
      
      if (!itemsContainer) return;
      
      // Show loading state
      itemsContainer.innerHTML = '<div class="loading">Loading your bids...</div>';
      
      // Map tab IDs to API status
      const statusMap = {
        'active-bids': 'active',
        'won-auctions': 'won',
        'lost-auctions': 'lost',
        'watchlist': 'watchlist'
      };
      
      // Build URL with query parameters
      let url = `${API_URL}/my-bids?status=${statusMap[currentTab]}&page=${currentPage}`;
      
      // Add sort parameter
      if (currentSort) {
        url += `&sort=${currentSort}`;
      }
      
      // Add search parameter if present
      if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`;
      }
      
      if (currentTab === 'watchlist') {
        try {
          // Make a specific API call for watchlist items
          const response = await fetch(`http://localhost:5000/api/watchlist?page=${currentPage}&limit=${itemsPerPage}`, {
            headers: {
              'x-auth-token': token
            }
          });
          
          if (!response.ok) {
            throw new Error('Failed to fetch watchlist');
          }
          
          const data = await response.json();
          
          if (!data.watchlist || data.watchlist.length === 0) {
            itemsContainer.innerHTML = `<div class="empty-state">You have no items in your watchlist</div>`;
            
            // Hide pagination
            const paginationContainer = activeContent.querySelector('.pagination');
            if (paginationContainer) {
              paginationContainer.style.display = 'none';
            }
            return;
          }
          
          // Display watchlist items
          displayWatchlistItems(data.watchlist, itemsContainer);
          
          // Update pagination
          updatePagination(data.pagination, activeContent);
          
        } catch (error) {
          console.error('Error fetching watchlist:', error);
          itemsContainer.innerHTML = '<div class="error-message">Failed to load your watchlist. Please try again later.</div>';
        }
      } else {
        const response = await fetch(url, {
          headers: {
            'x-auth-token': token
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch bids');
        }
        
        const data = await response.json();
        
        // Update tab counts
        updateTabCounts(data, currentTab);
        
        // Check if there are bids
        if (!data.bids || data.bids.length === 0) {
          itemsContainer.innerHTML = `<div class="empty-state">You have no ${statusMap[currentTab]} bids</div>`;
          
          // Hide pagination
          const paginationContainer = activeContent.querySelector('.pagination');
          if (paginationContainer) {
            paginationContainer.style.display = 'none';
          }
          
          return;
        }
        
        // Display bids
        displayBids(data.bids, itemsContainer, currentTab);
        
        // Update pagination
        updatePagination(data.pagination, activeContent);
      }
      
    } catch (error) {
      console.error('Error fetching bids:', error);
      const activeContent = document.getElementById(currentTab);
      const itemsContainer = activeContent.querySelector('.bid-items');
      
      if (itemsContainer) {
        itemsContainer.innerHTML = '<div class="error-message">Failed to load your bids. Please try again later.</div>';
      }
    }
  }
  
  /**
   * Display bids in the container
   */
  function displayBids(bids, container, tabId) {
    container.innerHTML = '';
    
    // Check if we have an empty search result
    if (bids.length === 0 && searchTerm) {
      container.innerHTML = `
        <div class="empty-search-message">
          <h3>No search results found</h3>
          <p>We couldn't find any bids matching "${searchTerm}".</p>
          <button class="btn-secondary clear-search">Clear Search</button>
        </div>
      `;
      
      // Add event listener to the clear search button
      const clearSearchBtn = container.querySelector('.clear-search');
      if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
          searchInput.value = '';
          searchTerm = '';
          if (searchResultsIndicator) {
            searchResultsIndicator.style.display = 'none';
          }
          currentPage = 1;
          fetchBids();
        });
      }
      return;
    }
    
    // Original display code with highlighting added
    bids.forEach(bid => {
      const bidItem = document.createElement('div');
      bidItem.className = 'bid-item';
      
      // Choose template based on tab
      if (tabId === 'active-bids') {
        bidItem.innerHTML = createActiveBidHTML(bid);
      } else if (tabId === 'won-auctions') {
        bidItem.innerHTML = createWonAuctionHTML(bid);
      } else if (tabId === 'lost-auctions') {
        bidItem.innerHTML = createLostAuctionHTML(bid);
      } else if (tabId === 'watchlist') {
        bidItem.innerHTML = createWatchlistHTML(bid);
      }
      
      // Apply search term highlighting if a search is active
      if (searchTerm) {
        const titleElement = bidItem.querySelector('h3');
        if (titleElement) {
          titleElement.innerHTML = highlightSearchTerm(titleElement.textContent, searchTerm);
        }
      }
      
      container.appendChild(bidItem);
    });
    
    // Initialize countdowns
    initializeCountdowns();
  }
  
  /**
   * Create HTML for an active bid
   */
  function createActiveBidHTML(bid) {
    const isHighestBidder = parseFloat(bid.userBid.amount) === parseFloat(bid.highestBid);
    let statusClass = '';
    let statusText = '';
    
    // Add this line to define 'now' before using it
    const now = new Date();
    
    // Define isEnded outside the if block so it's available throughout the function
    const endDate = new Date(bid.endsAt);
    const isEnded = now > endDate;
    
    if (isHighestBidder) {
        // Check if auction has ended - but don't redefine isEnded here
        if (isEnded) {
            // If auction ended but not sold yet (waiting for seller)
            statusClass = 'pending-seller';
            statusText = 'Waiting for Seller';
        } else {
            statusClass = 'highest-bidder';
            statusText = 'Highest Bidder';
        }
    } else {
        statusClass = 'outbid';
        statusText = 'Outbid';
    }
    
    return `
      <div class="bid-image">
        <img src="${bid.image || 'images/placeholder.jpg'}" alt="${bid.title}" onerror="this.src='images/placeholder.jpg'">
        <span class="time-left" data-ends="${bid.endsAt}">Loading...</span>
      </div>
      <div class="bid-details">
        <h3>${bid.title}</h3>
        <div class="bid-status ${statusClass}">
          <span class="status-badge">${statusText}</span>
          <p class="current-bid">Current Bid: €${parseFloat(bid.currentBid).toFixed(2)}</p>
          <p class="your-bid">Your Bid: €${parseFloat(bid.userBid.amount).toFixed(2)}</p>
        </div>
        <p class="bids-count">${bid.bidCount} bid${bid.bidCount !== 1 ? 's' : ''} total</p>
        <div class="bid-actions">
          <a href="item-details.html?id=${bid.auctionId}" class="btn-secondary">View Item</a>
          ${isHighestBidder && isEnded ? 
            '<button class="btn-text info-btn">Waiting for Seller to Confirm</button>' :
            `<a href="item-details.html?id=${bid.auctionId}#bid" class="btn-primary">
              ${isHighestBidder ? 'Increase Bid' : 'Bid Again'}
            </a>`
          }
        </div>
      </div>
    `;
}
  
  /**
   * Create HTML for a won auction
   */
  function createWonAuctionHTML(bid) {
    // Check if payment is already completed
    const isPaid = bid.status === 'paid';
    
    return `
      <div class="bid-image">
        <img src="${bid.image || 'images/placeholder.jpg'}" alt="${bid.title}" onerror="this.src='images/placeholder.jpg'">
      </div>
      <div class="bid-details">
        <h3>${bid.title}</h3>
        <div class="bid-status won ${isPaid ? 'paid' : ''}">
          <span class="status-badge">${isPaid ? 'Won & Paid' : 'Won on ' + formatDate(new Date(bid.endsAt))}</span>
          <p class="final-price">Final Price: €${parseFloat(bid.highestBid).toFixed(2)}</p>
          ${isPaid 
            ? `<p class="shipping-status">Shipping: In transit</p>` 
            : `<p class="your-bid">Your Bid: €${parseFloat(bid.userBid.amount).toFixed(2)}</p>`
          }
        </div>
        <div class="bid-actions">
          <a href="item-details.html?id=${bid.auctionId}" class="btn-secondary">View Item</a>
          ${isPaid 
            ? `<a href="tracking.html?id=${bid.auctionId}" class="btn-primary">Track Shipment</a>` 
            : `<a href="payment.html?id=${bid.auctionId}" class="btn-primary">Complete Payment</a>`
          }
        </div>
      </div>
    `;
  }
  
  
  
  /**
   * Create HTML for a watchlist item
   */
  function createWatchlistHTML(bid) {
    return `
      <div class="bid-image">
        <img src="${bid.image || 'images/placeholder.jpg'}" alt="${bid.title}" onerror="this.src='images/placeholder.jpg'">
        <span class="time-left" data-ends="${bid.endsAt}">Loading...</span>
      </div>
      <div class="bid-details">
        <h3>${bid.title}</h3>
        <p class="current-bid">Current Bid: €${parseFloat(bid.currentBid).toFixed(2)}</p>
        <p class="bids-count">${bid.bidCount} bid${bid.bidCount !== 1 ? 's' : ''} total</p>
        <div class="bid-actions">
          <a href="item-details.html?id=${bid.auctionId}" class="btn-secondary">View Item</a>
          <a href="item-details.html?id=${bid.auctionId}#bid" class="btn-primary">Place Bid</a>
          <button class="btn-text remove-watch" data-id="${bid.auctionId}">Remove from Watchlist</button>
        </div>
      </div>
    `;
  }
  
  /**
   * Update pagination UI
   */
  function updatePagination(pagination, container) {
    const paginationEl = container.querySelector('.pagination');
    if (!paginationEl) return;
    
    if (!pagination || pagination.totalPages <= 1) {
      paginationEl.style.display = 'none';
      return;
    }
    
    paginationEl.style.display = 'flex';
    paginationEl.innerHTML = '';
    
    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn' + (pagination.hasPrevPage ? '' : ' disabled');
    prevBtn.textContent = 'Previous';
    
    if (pagination.hasPrevPage) {
      prevBtn.addEventListener('click', () => {
        currentPage--;
        fetchBids();
      });
    }
    
    paginationEl.appendChild(prevBtn);
    
    // Page numbers
    for (let i = 1; i <= pagination.totalPages; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.className = 'page-btn' + (i === pagination.page ? ' active' : '');
      pageBtn.textContent = i;
      
      if (i !== pagination.page) {
        pageBtn.addEventListener('click', () => {
          currentPage = i;
          fetchBids();
        });
      }
      
      paginationEl.appendChild(pageBtn);
    }
    
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn' + (pagination.hasNextPage ? '' : ' disabled');
    nextBtn.textContent = 'Next';
    
    if (pagination.hasNextPage) {
      nextBtn.addEventListener('click', () => {
        currentPage++;
        fetchBids();
      });
    }
    
    paginationEl.appendChild(nextBtn);
  }
  
  /**
   * Update the bid counts in tab buttons
   */
  function updateTabCounts(data, tabType) {
    // Update the current tab with pagination data
    const currentTabBtn = document.querySelector(`.tab-button[data-tab="${currentTab}"]`);
    if (currentTabBtn && data.pagination) {
      const tabName = currentTabBtn.textContent.split('(')[0].trim();
      currentTabBtn.textContent = `${tabName} (${data.pagination.total})`;
    }
    
    // If this is a watchlist response, update the watchlist tab specifically
    if (tabType === 'watchlist' && data.watchlist) {
      const watchlistTab = document.querySelector(`.tab-button[data-tab="watchlist"]`);
      if (watchlistTab) {
        watchlistTab.textContent = `Watchlist (${data.pagination.total})`;
      }
    }
  }
  
  /**
   * Format date for display
   */
  function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    }).format(date);
  }
  
  /**
   * Initialize countdown timers
   */
  function initializeCountdowns() {
    const timeElements = document.querySelectorAll('.time-left');
    
    timeElements.forEach(updateTimer);
    
    setInterval(() => {
      timeElements.forEach(updateTimer);
    }, 1000);
  }
  
  /**
   * Update a single timer element
   */
  function updateTimer(element) {
    const endTime = new Date(element.getAttribute('data-ends'));
    const now = new Date();
    
    const diff = endTime - now;
    
    if (diff <= 0) {
      element.textContent = 'Ended';
      element.classList.add('ended');
      return;
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    let timeDisplay;
    
    if (days > 0) {
      timeDisplay = `${days}d ${hours}h left`;
    } else if (hours > 0) {
      timeDisplay = `${hours}h ${minutes}m left`;
    } else {
      timeDisplay = `${minutes}m ${seconds}s left`;
      
      if (minutes < 10) {
        element.classList.add('urgent');
      }
    }
    
    element.textContent = timeDisplay;
  }

  // Add this function to handle watchlist items display
  function displayWatchlistItems(items, container) {
    container.innerHTML = '';
    
    // Check if we have an empty search result
    if (items.length === 0 && searchTerm) {
      container.innerHTML = `
        <div class="empty-search-message">
          <h3>No search results found</h3>
          <p>We couldn't find any watchlist items matching "${searchTerm}".</p>
          <button class="btn-secondary clear-search">Clear Search</button>
        </div>
      `;
      
      // Add event listener to the clear search button
      const clearSearchBtn = container.querySelector('.clear-search');
      if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
          searchInput.value = '';
          searchTerm = '';
          if (searchResultsIndicator) {
            searchResultsIndicator.style.display = 'none';
          }
          currentPage = 1;
          fetchBids();
        });
      }
      return;
    }
    
    items.forEach(item => {
      const watchlistItem = document.createElement('div');
      watchlistItem.className = 'bid-item';
      watchlistItem.innerHTML = createWatchlistHTML(item);
      
      // Apply search term highlighting if a search is active
      if (searchTerm) {
        const titleElement = watchlistItem.querySelector('h3');
        if (titleElement) {
          titleElement.innerHTML = highlightSearchTerm(titleElement.textContent, searchTerm);
        }
      }
      
      container.appendChild(watchlistItem);
    });
    
    // Initialize countdowns
    initializeCountdowns();
    
    // Add event listeners for remove buttons
    container.querySelectorAll('.remove-watch').forEach(btn => {
      btn.addEventListener('click', async function() {
        const auctionId = this.getAttribute('data-id');
        try {
          await removeFromWatchlist(auctionId);
          this.closest('.bid-item').remove();
          updateWatchlistCount(-1);
          
          // Check if now empty
          if (container.children.length === 0) {
            if (searchTerm) {
              container.innerHTML = `
                <div class="empty-search-message">
                  <h3>No search results found</h3>
                  <p>We couldn't find any watchlist items matching "${searchTerm}".</p>
                  <button class="btn-secondary clear-search">Clear Search</button>
                </div>
              `;
              
              // Add event listener to the clear search button
              const clearSearchBtn = container.querySelector('.clear-search');
              if (clearSearchBtn) {
                clearSearchBtn.addEventListener('click', function() {
                  searchInput.value = '';
                  searchTerm = '';
                  if (searchResultsIndicator) {
                    searchResultsIndicator.style.display = 'none';
                  }
                  currentPage = 1;
                  fetchBids();
                });
              }
            } else {
              container.innerHTML = '<div class="empty-state">You have no items in your watchlist</div>';
            }
          }
        } catch (error) {
          console.error('Error removing from watchlist:', error);
        }
      });
    });
  }

  // Function to update the watchlist count in the tab button
  function updateWatchlistCount(change) {
    const watchlistTab = document.querySelector('[data-tab="watchlist"]');
    if (watchlistTab) {
      const currentText = watchlistTab.textContent;
      const match = currentText.match(/\((\d+)\)/);
      if (match) {
        const currentCount = parseInt(match[1]);
        const newCount = Math.max(0, currentCount + change);
        watchlistTab.textContent = `Watchlist (${newCount})`;
      }
    }
  }
  
  // Function to remove item from watchlist
  async function removeFromWatchlist(auctionId) {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`http://localhost:5000/api/watchlist/${auctionId}`, {
      method: 'DELETE',
      headers: {
        'x-auth-token': token
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to remove from watchlist');
    }
    
    // Update watchlist count
    updateWatchlistCount(-1);
    
    return await response.json();
  }

  /**
   * Perform search with the current input value
   */
  function performSearch() {
    const term = searchInput.value.trim();
    if (term !== searchTerm) {
      // Only update if term has changed
      searchTerm = term;
      currentPage = 1; // Reset to page 1 for new search
      
      // Update search indicator
      updateSearchIndicator();
      
      // Fetch filtered results
      fetchBids();
    }
  }
  
  /**
   * Update search indicator based on current search
   */
  function updateSearchIndicator() {
    if (!searchResultsIndicator || !searchTermDisplay) return;
    
    if (searchTerm) {
      searchTermDisplay.textContent = searchTerm;
      searchResultsIndicator.style.display = 'flex';
    } else {
      searchResultsIndicator.style.display = 'none';
    }
  }
  
  // Add this to your displayBids and displayWatchlistItems functions to highlight search terms
  function highlightSearchTerm(text, term) {
    if (!term) return text;
    
    const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp('(' + escapedTerm + ')', 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
  }
  
  // Add this function to fetch all tab counts on page load
  async function fetchAllTabCounts() {
    try {
      // Get counts for active bids, won auctions, and watchlist
      const response = await fetch(`http://localhost:5000/api/bids/counts`, {
        headers: {
          'x-auth-token': token
        }
      });
      
      if (!response.ok) {
        console.error('Failed to fetch tab counts');
        return;
      }
      
      const data = await response.json();
      
      // Update tab counts with actual values
      updateTabCountElement('active-bids', data.activeBids || 0);
      updateTabCountElement('won-auctions', data.wonAuctions || 0);
      updateTabCountElement('watchlist', data.watchlist || 0);
      
    } catch (error) {
      console.error('Error fetching tab counts:', error);
    }
  }

  // Add this helper function to update a specific tab count
  function updateTabCountElement(tabId, count) {
    const tabElement = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
    if (tabElement) {
      const tabName = tabId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      tabElement.textContent = `${tabName} (${count})`;
    }
  }

  // Call this function on page load
  fetchAllTabCounts();

  // Initial fetch
  fetchBids();
});