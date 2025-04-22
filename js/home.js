document.addEventListener('DOMContentLoaded', function() {
  loadFeaturedAuctions();

  function loadFeaturedAuctions() {
    const auctionGrid = document.querySelector('.featured-auctions .auction-grid');
    
    // Show loading state
    auctionGrid.innerHTML = '<div class="loading">Loading featured auctions...</div>';
    
    // Fetch random active auctions
    fetch('http://localhost:5000/api/auctions/random-active?limit=12')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load featured auctions');
        }
        return response.json();
      })
      .then(data => {
        // Clear loading message
        auctionGrid.innerHTML = '';
        
        if (data.listings && data.listings.length > 0) {
          // Display the auctions
          data.listings.forEach(listing => {
            displayAuctionItem(listing, auctionGrid);
          });
          
          // Initialize countdown timers
          initializeCountdowns();
        } else {
          auctionGrid.innerHTML = '<div class="empty-message">No featured auctions available at the moment.</div>';
        }
      })
      .catch(error => {
        console.error('Error loading featured auctions:', error);
        auctionGrid.innerHTML = '<div class="error-message">Failed to load featured auctions. Please try again.</div>';
      });
  }
  
  function displayAuctionItem(auction, container) {
    const endDate = new Date(auction.ends_at);
    const imageUrl = auction.images && auction.images.length > 0 
      ? auction.images[0] 
      : 'https://via.placeholder.com/400x300?text=No+Image';
    
    const auctionItem = document.createElement('div');
    auctionItem.className = 'auction-item';
    
    auctionItem.innerHTML = `
      <div class="auction-image">
        <img src="${imageUrl}" alt="${auction.title}" onerror="this.src='https://via.placeholder.com/400x300?text=Image+Error';">
        <span class="time-left" data-ends="${endDate.toISOString()}">Loading...</span>
      </div>
      <div class="auction-details">
        <h3>${auction.title}</h3>
        <p class="current-bid">Current Price: €${parseFloat(auction.current_bid).toFixed(2)}</p>
        <p class="bids-count">${auction.bid_count || 0} bid${auction.bid_count !== 1 ? 's' : ''}</p>
        <a href="item-details.html?id=${auction.id}" class="btn-secondary">Bid Now</a>
      </div>
    `;
    
    container.appendChild(auctionItem);
  }
  
  function initializeCountdowns() {
    // Get all time-left elements
    const timeElements = document.querySelectorAll('.featured-auctions .time-left');
    
    // Update each timer immediately
    timeElements.forEach(updateTimer);
    
    // Set interval to update timers every second
    setInterval(() => {
      timeElements.forEach(updateTimer);
    }, 1000);
  }
  
  function updateTimer(element) {
    // Get end time from data attribute
    const endTime = new Date(element.getAttribute('data-ends'));
    const now = new Date();
    
    // Calculate remaining time
    const diff = endTime - now;
    
    // If auction is ended
    if (diff <= 0) {
      element.textContent = 'Ended';
      element.classList.add('ended');
      return;
    }
    
    // Calculate days, hours, minutes, and seconds
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    // Format display based on remaining time
    let timeDisplay;
    
    if (days > 0) {
      timeDisplay = `${days}d ${hours}h left`;
    } else if (hours > 0) {
      timeDisplay = `${hours}h ${minutes}m left`;
    } else {
      timeDisplay = `${minutes}m ${seconds}s left`;
      
      // Add urgent class when less than 10 minutes remaining
      if (minutes < 10) {
        element.classList.add('urgent');
      }
    }
    
    // Update element text
    element.textContent = timeDisplay;
  }
});