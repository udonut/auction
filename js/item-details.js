/**
 * Item details page functionality
 */
document.addEventListener('DOMContentLoaded', function() {
    // Get auction ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const auctionId = urlParams.get('id');
    
    if (!auctionId) {
        displayError('No auction ID provided');
        return;
    }
    
    // Fetch auction details
    fetchAuctionDetails(auctionId);
    
    // Initialize tabs
    initTabs();
});

/**
 * Fetch auction details from API
 */
function fetchAuctionDetails(auctionId) {
    // Instead of replacing the entire content, add loading indicators to each section
    const galleryContainer = document.querySelector('.item-gallery');
    if (galleryContainer) {
        galleryContainer.innerHTML = '<div class="loading">Loading images...</div>';
    }
    
    const biddingContainer = document.querySelector('.item-bidding');
    if (biddingContainer) {
        biddingContainer.innerHTML = '<div class="loading">Loading auction details...</div>';
    }
    
    const descriptionContainer = document.getElementById('description');
    if (descriptionContainer) {
        descriptionContainer.innerHTML = '<div class="loading">Loading description...</div>';
    }
    
    // Fetch auction data
    fetch(`http://localhost:5000/api/auctions/${auctionId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load auction details');
            }
            return response.json();
        })
        .then(auction => {
            renderAuctionDetails(auction);
        })
        .catch(error => {
            console.error('Error fetching auction details:', error);
            displayError('Failed to load auction details. Please try again later.');
        });
}

/**
 * Render auction details to the page
 */
function renderAuctionDetails(auction) {
    
    // Check if containers exist
    const galleryContainer = document.querySelector('.item-gallery');
    const biddingContainer = document.querySelector('.item-bidding');
    const descriptionContainer = document.getElementById('description');
    
    // Update page title with item name
    document.title = `${auction.title} | BidMaster`;
    
    // Update breadcrumb
    updateBreadcrumb(auction);
    
    // Set page header with title including condition but not year
    const header = document.querySelector('.item-details-header h1');
    if (header) {
        header.textContent = `${auction.title} - ${auction.item_condition} Condition`;
    }
    
    // Populate gallery
    populateGallery(auction.images);
    
    // Populate bidding information
    populateBidding(auction);
    
    // Populate description
    populateDescription(auction);
    
    // Initialize gallery functionality
    initGallery();
    
    // Start countdown timer
    startCountdown(auction.ends_at);
    
    // Initialize watchlist button
    initWatchlistButton(auction.id);
}

/**
 * Update breadcrumb navigation
 */
function updateBreadcrumb(auction) {
    const breadcrumb = document.querySelector('.item-breadcrumb');
    if (breadcrumb) {
        breadcrumb.innerHTML = `
            <a href="index.html">Home</a> &gt;
            <a href="listings.html">All Listings</a> &gt;
            <a href="listings.html?category=${auction.category}">${auction.category}</a> &gt;
            ${auction.title}
        `;
    }
}

/**
 * Populate image gallery
 */
function populateGallery(images) {
    const galleryContainer = document.querySelector('.item-gallery');
    if (!galleryContainer) return;
    
    // Parse images if needed
    let imageArray = images;
    if (typeof images === 'string') {
        try {
            imageArray = JSON.parse(images);
        } catch (e) {
            imageArray = [images];
        }
    }
    
    // Ensure imageArray is an array
    if (!Array.isArray(imageArray)) {
        imageArray = [];
    }
    
    // Use placeholder if no images
    if (imageArray.length === 0) {
        imageArray = ['https://picsum.photos/800/600?text=No+Image+Available'];
    }
    
    // Create main image (without zoom icon)
    const mainImageHTML = `
        <div class="main-image">
            <img src="${imageArray[0]}" alt="Item main image" id="main-image" onerror="this.src='https://picsum.photos/800/600?text=Image+Error';">
        </div>
    `;
    
    // Create thumbnails
    let thumbnailsHTML = '<div class="gallery-thumbnails">';
    
    imageArray.forEach((img, index) => {
        thumbnailsHTML += `
            <div class="thumbnail ${index === 0 ? 'active' : ''}">
                <img src="${img}" alt="Item thumbnail ${index + 1}" data-index="${index}" onerror="this.src='https://picsum.photos/100/100?text=Error';">
            </div>
        `;
    });
    
    thumbnailsHTML += '</div>';
    
    // Update gallery HTML
    galleryContainer.innerHTML = mainImageHTML + thumbnailsHTML;
}

/**
 * Populate bidding information
 */
function populateBidding(auction) {
    const biddingContainer = document.querySelector('.item-bidding');
    if (!biddingContainer) return;
    
    // Calculate current bid price
    const currentBid = auction.current_bid || auction.starting_price;
    
    // Format bid amount
    const formattedBid = parseFloat(currentBid).toFixed(2);
    
    // Check if current user is the seller
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isOwner = user.id === auction.seller_id;
    
    // Check if auction has ended
    const now = new Date();
    const auctionEndTime = new Date(auction.ends_at);
    const isAuctionEnded = auction.status === 'ended' || now > auctionEndTime;
    
    // Create bidding HTML without "Auction Active" status
    let biddingHTML = `
        <div class="time-remaining">
            <h3>Time Remaining</h3>
            <div class="countdown" id="auction-countdown">
                <div class="countdown-block">
                    <div class="countdown-value" id="days">--</div>
                    <div class="countdown-label">Days</div>
                </div>
                <div class="countdown-block">
                    <div class="countdown-value" id="hours">--</div>
                    <div class="countdown-label">Hours</div>
                </div>
                <div class="countdown-block">
                    <div class="countdown-value" id="minutes">--</div>
                    <div class="countdown-label">Minutes</div>
                </div>
                <div class="countdown-block">
                    <div class="countdown-value" id="seconds">--</div>
                    <div class="countdown-label">Seconds</div>
                </div>
            </div>
        </div>

        <div class="current-bid-info">
            <h3>Current Bid</h3>
            <div class="current-bid-amount">€${formattedBid}</div>
            <div class="bid-stats">
                <div class="bid-count">${auction.bid_count || 0} bid${auction.bid_count !== 1 ? 's' : ''}</div>
            </div>
            ${auction.reserve_price && parseFloat(currentBid) >= parseFloat(auction.reserve_price) ? 
              '<p class="reserve-status"><strong>Reserve price met</strong></p>' : 
              (auction.reserve_price ? '<p class="reserve-status"><em>Reserve price not yet met</em></p>' : '')}
        </div>`;
    
    // Only show owner message if user is the seller AND auction is not ended
    if (isOwner && !isAuctionEnded) {
        // Check if there are bids on the item (current_bid exists and is not just the starting price)
        const hasBids = auction.current_bid && auction.bid_count && auction.bid_count > 0;
        
        biddingHTML += `
        <div class="owner-message">
            <div class="info-box">
                <p><strong>This is your listing</strong></p>
                <p>You cannot bid on your own item. You can view bids in the Bids tab below.</p>
            </div>
            ${hasBids ? `
            <button class="btn-primary sell-now-btn" style="margin-top: 15px; width: 100%;">
                Sell Now at €${parseFloat(currentBid).toFixed(2)}
            </button>
            ` : ''}
        </div>`;
    } else if (!isOwner && !isAuctionEnded) {
        // Only show bid form if auction is not ended and user is not the owner
        biddingHTML += `
        <div class="bid-form">
            <h3>Place Bid</h3>
            <div class="bid-input-container">
                <div class="bid-currency">€</div>
                <input type="number" class="bid-input" min="${parseFloat(currentBid) + 5}" step="5" value="${parseFloat(currentBid) + 5}">
            </div>
            <div class="bid-options">
                <button class="bid-option">€${(parseFloat(currentBid) + 5).toFixed(2)}</button>
                <button class="bid-option">€${(parseFloat(currentBid) + 10).toFixed(2)}</button>
                <button class="bid-option">€${(parseFloat(currentBid) + 25).toFixed(2)}</button>
                <button class="bid-option">€${(parseFloat(currentBid) + 50).toFixed(2)}</button>
            </div>
            
            <div class="bid-form-actions">
                <button class="btn-primary">Place Bid</button>
                <button class="btn-secondary watchlist-button">
                    <span>Add to Watchlist</span>
                </button>
            </div>
        </div>`;
    } else if (isAuctionEnded) {
        // Show auction ended message for both owner and non-owner
        biddingHTML += `
        <div class="auction-ended-message">
            <div class="info-box" style="background-color: #f8f0f0; border-left-color: #e74c3c;">
                <p><strong>This auction has ended</strong></p>
                <p>Final price: €${formattedBid}</p>
            </div>
        </div>`;
    }

    biddingHTML += `
        <div class="shipping-info">
            <h3>Shipping & Pickup</h3>
            ${renderShippingOptions(auction.shipping_options)}
        </div>
    `;
    
    // Update HTML
    biddingContainer.innerHTML = biddingHTML;
    
    // Add event listeners for bid options
    if (!isOwner && !isAuctionEnded) {
        document.querySelectorAll('.bid-option').forEach(btn => {
            btn.addEventListener('click', function() {
                const bidInput = document.querySelector('.bid-input');
                if (bidInput) {
                    bidInput.value = this.textContent.replace('$', '');
                }
            });
        });
        
        // Add event listener for the place bid button
        const placeBidButton = document.querySelector('.bid-form-actions .btn-primary');
        if (placeBidButton) {
            placeBidButton.addEventListener('click', function() {
                placeBid(auction.id);
            });
        }
    }
    
    // Add sell now button event listener
    const sellNowBtn = biddingContainer.querySelector('.sell-now-btn');
    if (sellNowBtn) {
        sellNowBtn.addEventListener('click', function() {
            confirmSellNow(auction.id, currentBid);
        });
    }
}

/**
 * Show confirmation dialog for "Sell Now" action
 */
function confirmSellNow(auctionId, currentBid) {
    const formattedBid = parseFloat(currentBid).toFixed(2);
    
    // Create modal if it doesn't exist
    let modal = document.getElementById('sell-now-modal');
    if (!modal) {
        // Create the modal element
        modal = document.createElement('div');
        modal.id = 'sell-now-modal';
        modal.className = 'modal-overlay';
        
        // Set modal content
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Confirm Sale</h2>
                </div>
                <div class="modal-body">
                    <p>Are you sure you want to end this auction now and sell for €${formattedBid}?</p>
                    <p class="modal-warning">This action cannot be undone.</p>
                </div>
                <div class="modal-footer">
                    <button id="confirm-sell" class="btn-primary">Yes, Sell Now</button>
                    <button id="cancel-sell" class="btn-secondary">Cancel</button>
                </div>
            </div>
        `;
        
        // Add to document
        document.body.appendChild(modal);
        
        // Add event listeners
        document.getElementById('confirm-sell').addEventListener('click', function() {
            // Close modal
            modal.style.display = 'none';
            // Process the sell action
            sellNowAuction(auctionId);
        });
        
        document.getElementById('cancel-sell').addEventListener('click', function() {
            // Just close the modal
            modal.style.display = 'none';
        });
        
        // Close when clicking outside the modal content
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    } else {
        // Update the price in case it changed
        const priceElement = modal.querySelector('.modal-body p');
        if (priceElement) {
            priceElement.textContent = `Are you sure you want to end this auction now and sell for €${formattedBid}?`;
        }
    }
    
    // Display the modal
    modal.style.display = 'flex';
}

/**
 * Process the sell now action
 */
async function sellNowAuction(auctionId) {
    try {
        // Get auth token
        const token = localStorage.getItem('token');
        if (!token) {
            showBidMessage('You must be logged in to perform this action', 'error');
            return;
        }
        
        // Display loading state
        const sellNowBtn = document.querySelector('.sell-now-btn');
        if (sellNowBtn) {
            sellNowBtn.disabled = true;
            sellNowBtn.textContent = 'Processing...';
        }
        
        // Call the API to end the auction
        const response = await fetch(`http://localhost:5000/api/auctions/${auctionId}/sell-now`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to end auction');
        }
        
        // Show success message and update UI
        showBidMessage('Auction ended successfully! The item has been sold to the highest bidder.', 'success');
        
        // Replace the countdown with an "Auction Ended" message
        const countdownEl = document.getElementById('auction-countdown');
        if (countdownEl) {
            countdownEl.innerHTML = '<div class="auction-ended">This auction has ended</div>';
        }
        
        // Remove the sell now button
        if (sellNowBtn) {
            sellNowBtn.remove();
        }
        
        // Reload bid history to show updated status
        loadBidHistory();
        
    } catch (error) {
        console.error('Error ending auction:', error);
        showBidMessage(error.message || 'Failed to end the auction. Please try again.', 'error');
        
        // Reset button state
        const sellNowBtn = document.querySelector('.sell-now-btn');
        if (sellNowBtn) {
            sellNowBtn.disabled = false;
            sellNowBtn.textContent = 'Sell Now';
        }
    }
}

/**
 * Render shipping options
 */
function renderShippingOptions(shippingOptions) {
    // Handle case where shipping options is null or undefined
    if (!shippingOptions) {
        return '<p>No shipping information provided</p>';
    }
    
    let optionsArray = [];
    
    // Parse shipping options if it's a string (JSON)
    if (typeof shippingOptions === 'string') {
        try {
            optionsArray = JSON.parse(shippingOptions);
        } catch (e) {
            console.error('Error parsing shipping options:', e);
            return '<p>Error displaying shipping options</p>';
        }
    } else if (Array.isArray(shippingOptions)) {
        optionsArray = shippingOptions;
    }
    
    // If we still don't have valid options, return a default message
    if (!Array.isArray(optionsArray) || optionsArray.length === 0) {
        return '<p>No shipping information provided</p>';
    }
    
    // Create shipping options HTML
    let html = '';
    
    optionsArray.forEach(option => {
        let icon = '📦';  // Default shipping icon
        let title = 'Shipping';
        
        // Handle the specific shipping option types
        if (typeof option === 'object' && option !== null) {
            // Get the shipping type (domestic, international, pickup)
            if (option.type === 'pickup') {
                icon = '🏠';
                title = 'Local Pickup';
            } else if (option.type === 'domestic') {
                icon = '📦';
                title = 'Domestic Shipping';
            } else if (option.type === 'international') {
                icon = '🌎';
                title = 'International Shipping';
            }
        } else if (typeof option === 'string') {
            // Handle string options
            if (option.toLowerCase().includes('pickup')) {
                icon = '🏠';
                title = 'Local Pickup';
            } else if (option.toLowerCase().includes('international')) {
                icon = '🌎';
                title = 'International Shipping';
            } else if (option.toLowerCase().includes('domestic')) {
                icon = '📦';
                title = 'Domestic Shipping';
            }
            
        }
        
        html += `
            <div class="shipping-option">
                <div class="shipping-icon">${icon}</div>
                <div class="shipping-details">
                    <div class="shipping-name">${title}</div>
                </div>
            </div>
        `;
    });
    
    return html || '<p>No shipping information provided</p>';
}

/**
 * Populate description tab
 */
function populateDescription(auction) {
    const descriptionTab = document.getElementById('description');
    if (!descriptionTab) return;
    
    const descriptionHTML = `
        <h2>Item Description</h2>
        <p>${auction.description || 'No description provided.'}</p>

        <div class="item-specs">
            <div class="spec-item">
                <div class="spec-label">Condition</div>
                <div class="spec-value">${auction.item_condition || 'Not specified'}</div>
            </div>
        </div>
    `;
    
    descriptionTab.innerHTML = descriptionHTML;
}

/**
 * Initialize thumbnail gallery
 */
function initGallery() {
    const thumbnails = document.querySelectorAll('.thumbnail');
    const mainImage = document.getElementById('main-image');
    
    if (thumbnails.length && mainImage) {
        thumbnails.forEach(thumb => {
            thumb.addEventListener('click', function() {
                // Remove active class from all thumbnails
                thumbnails.forEach(t => t.classList.remove('active'));
                
                // Add active class to clicked thumbnail
                this.classList.add('active');
                
                // Update main image
                const imgElement = this.querySelector('img');
                if (imgElement) {
                    mainImage.src = imgElement.src;
                    mainImage.alt = imgElement.alt;
                }
            });
        });
    }
}

/**
 * Start countdown timer for auction end
 */
function startCountdown(endTimeStr) {
    const endTime = new Date(endTimeStr);
    const countdownEl = document.getElementById('auction-countdown');
    
    if (!countdownEl) return;
    
    // Check if auction has already ended
    const now = new Date();
    if (endTime <= now) {
        // Auction has already ended, show ended message
        countdownEl.innerHTML = '<div class="auction-ended">This auction has ended</div>';
        return;
    }
    
    // Update timer immediately
    updateCountdown();
    
    // Then update every second
    const interval = setInterval(updateCountdown, 1000);
    
    function updateCountdown() {
        const now = new Date();
        const diff = endTime - now;
        
        if (diff <= 0) {
            // Clear interval when countdown reaches zero
            clearInterval(interval);
            
            // Show auction ended message
            countdownEl.innerHTML = '<div class="auction-ended">This auction has ended</div>';
            return;
        }
        
        // Calculate days, hours, minutes, and seconds
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        // Get DOM elements with null checks
        const daysEl = document.getElementById('days');
        const hoursEl = document.getElementById('hours');
        const minutesEl = document.getElementById('minutes');
        const secondsEl = document.getElementById('seconds');
        
        // Only update if elements exist
        if (daysEl) daysEl.textContent = days.toString().padStart(2, '0');
        if (hoursEl) hoursEl.textContent = hours.toString().padStart(2, '0');
        if (minutesEl) minutesEl.textContent = minutes.toString().padStart(2, '0');
        if (secondsEl) secondsEl.textContent = seconds.toString().padStart(2, '0');
    }
}

/**
 * Display error message
 */
function displayError(message) {
    const galleryContainer = document.querySelector('.item-gallery');
    if (galleryContainer) {
        galleryContainer.innerHTML = '<div class="error-message">Failed to load images</div>';
    }
    
    const biddingContainer = document.querySelector('.item-bidding');
    if (biddingContainer) {
        biddingContainer.innerHTML = `
            <div class="error-message">
                <h2>Error</h2>
                <p>${message}</p>
                <a href="listings.html" class="btn-secondary">Return to Listings</a>
            </div>
        `;
    }
    
    const descriptionContainer = document.getElementById('description');
    if (descriptionContainer) {
        descriptionContainer.innerHTML = '<div class="error-message">Failed to load description</div>';
    }
}

/**
 * Initialize tabs
 */
function initTabs() {
    const tabButtons = document.querySelectorAll('.item-tab-button');
    const tabContents = document.querySelectorAll('.item-tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to selected button and content
            button.classList.add('active');
            document.getElementById(tabId).classList.add('active');
            
            // Load bid history if the bids tab is selected
            if (tabId === 'bids') {
                loadBidHistory();
            }
        });
    });
}

/**
 * Load bid history
 */
async function loadBidHistory() {
    const auctionId = getAuctionIdFromUrl();
    if (!auctionId) return;
    
    const bidHistoryContainer = document.querySelector('.bid-history-container');
    if (!bidHistoryContainer) return;
    
    try {
        bidHistoryContainer.innerHTML = '<div class="loading">Loading bid history...</div>';
        
        // Get the token if available (for highlighting user's bids)
        const token = localStorage.getItem('token') || '';
        
        // Fetch bid history from API
        const response = await fetch(`http://localhost:5000/api/bids/auctions/${auctionId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load bid history');
        }
        
        const data = await response.json();
        
        // Handle case when there are no bids
        if (data.bids.length === 0) {
            bidHistoryContainer.innerHTML = `
                <div class="no-bids-message">
                    <p>No bids have been placed yet.</p>
                    <p class="be-first">Be the first to bid on this item!</p>
                </div>
            `;
            return;
        }
        
        // Get current user data to highlight their bids
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        const currentUserId = userData.id;
        
        // Create bid history table
        const bidHistoryHTML = `
            <h3>Bid History (${data.bids.length} ${data.bids.length === 1 ? 'bid' : 'bids'})</h3>
            <table class="bid-history-table">
                <thead>
                    <tr>
                        <th>Bidder</th>
                        <th>Amount</th>
                        <th>Date & Time</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.bids.map(bid => {
                        const isCurrentUser = bid.user.id === currentUserId;
                        return `
                            <tr class="${isCurrentUser ? 'user-bid' : ''}">
                                <td>${formatBidder(bid.user.name, isCurrentUser)}</td>
                                <td>€${parseFloat(bid.amount).toFixed(2)}</td>
                                <td>${formatDate(new Date(bid.createdAt))}</td>
                                <td>${bid.status === 'active' ? 
                                    '<span class="status-badge highest">Current highest</span>' : 
                                    '<span class="status-badge outbid">Outbid</span>'}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        
        bidHistoryContainer.innerHTML = bidHistoryHTML;
        
    } catch (error) {
        console.error('Error loading bid history:', error);
        bidHistoryContainer.innerHTML = '<div class="error-message">Failed to load bid history. Please try again later.</div>';
    }
}

/**
 * Helper function to format bidder name
 */
function formatBidder(name, isCurrentUser) {
    if (isCurrentUser) {
        return `${name} (You)`;
    }
    
    // Mask other bidders' names for privacy
    if (name.length <= 2) return name;
    return `${name.charAt(0)}${'*'.repeat(name.length - 2)}${name.charAt(name.length - 1)}`;
}

/**
 * Helper function to format date
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
 * Helper function to get auction ID from URL
 */
function getAuctionIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

/**
 * Load item details and bid history if on bids tab
 */
async function loadItemDetails() {
    // Your existing code for loading the item...
    
    // After successfully loading the item, also load the bid history 
    // if we're already on the bids tab
    const bidsTab = document.querySelector('.item-tab-button[data-tab="bids"]');
    if (bidsTab && bidsTab.classList.contains('active')) {
        loadBidHistory();
    }
}

/**
 * Place a bid on the current auction
 * @param {number} auctionId - ID of the auction
 */
async function placeBid(auctionId) {
    // Check if logged in
    const token = localStorage.getItem('token');
    if (!token) {
        showBidMessage('You must be logged in to place a bid', 'error');
        return;
    }
    
    // Get bid amount
    const bidInput = document.querySelector('.bid-input');
    if (!bidInput) return;
    
    const bidAmount = parseFloat(bidInput.value);
    if (isNaN(bidAmount) || bidAmount <= 0) {
        showBidMessage('Please enter a valid bid amount', 'error');
        return;
    }
    
    // Get current bid to check minimum
    const currentBidElement = document.querySelector('.current-bid-amount');
    const currentBid = currentBidElement ? 
        parseFloat(currentBidElement.textContent.replace('$', '')) : 0;
    
    // Ensure bid is higher than current bid
    if (bidAmount <= currentBid) {
        showBidMessage(`Your bid must be higher than the current bid (€${currentBid.toFixed(2)})`, 'error');
        return;
    }
    
    try {
        // Show loading state
        const placeBidButton = document.querySelector('.bid-form-actions .btn-primary');
        if (placeBidButton) {
            const originalText = placeBidButton.textContent;
            placeBidButton.disabled = true;
            placeBidButton.textContent = 'Processing...';
        }
        
        // Send bid to server
        const response = await fetch('http://localhost:5000/api/bids', {
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
        
        // Show success message
        showBidMessage('Your bid was successfully placed!', 'success');
        
        // Update UI with new bid
        updateBidUI(bidAmount);
        
        // Reload bid history if the bids tab is open
        const bidsTab = document.querySelector('.item-tab-button[data-tab="bids"]');
        if (bidsTab && bidsTab.classList.contains('active')) {
            loadBidHistory();
        }
        
    } catch (error) {
        console.error('Error placing bid:', error);
        
        // Show more detailed error message for debugging
        const errorMessage = error.message || 'Failed to place bid. Please try again.';
        console.log('Full error details:', errorMessage);
        
        showBidMessage(errorMessage, 'error');
    } finally {
        // Restore button state
        const placeBidButton = document.querySelector('.bid-form-actions .btn-primary');
        if (placeBidButton) {
            placeBidButton.disabled = false;
            placeBidButton.textContent = 'Place Bid';
        }
    }
}

/**
 * Show a bid message (success or error)
 * @param {string} message - Message to display
 * @param {string} type - 'success' or 'error'
 */
function showBidMessage(message, type) {
    // Create message element if it doesn't exist
    let messageElement = document.querySelector('.bid-message');
    if (!messageElement) {
        messageElement = document.createElement('div');
        messageElement.className = 'bid-message';
        
        // Insert after bid form
        const bidForm = document.querySelector('.bid-form');
        if (bidForm) {
            bidForm.appendChild(messageElement);
        }
    }
    
    // Set message content and class
    messageElement.textContent = message;
    messageElement.className = `bid-message ${type}`;
    
    // Show message
    messageElement.style.display = 'block';
    
    // Automatically hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            messageElement.style.display = 'none';
        }, 5000);
    }
}

/**
 * Update UI with new bid information
 * @param {number} newBidAmount - The new bid amount
 */
function updateBidUI(newBidAmount) {
    // Update current bid display
    const currentBidElement = document.querySelector('.current-bid-amount');
    if (currentBidElement) {
        currentBidElement.textContent = `€${newBidAmount.toFixed(2)}`;
    }
    
    // Update bid count
    const bidCountElement = document.querySelector('.bid-stats .bid-count');
    if (bidCountElement) {
        let count = parseInt(bidCountElement.textContent) || 0;
        count++;
        bidCountElement.textContent = `${count} ${count === 1 ? 'bid' : 'bids'}`;
    }
    
    // Update input field to suggest a higher bid
    const bidInput = document.querySelector('.bid-input');
    if (bidInput) {
        bidInput.value = (newBidAmount + 5).toFixed(2);
        bidInput.min = (newBidAmount + 1).toFixed(2);
    }
    
    // Update bid options
    const bidOptions = document.querySelectorAll('.bid-option');
    if (bidOptions.length > 0) {
        bidOptions[0].textContent = `€${(newBidAmount + 5).toFixed(2)}`;
        bidOptions[1].textContent = `€${(newBidAmount + 10).toFixed(2)}`;
        bidOptions[2].textContent = `€${(newBidAmount + 25).toFixed(2)}`;
        bidOptions[3].textContent = `€${(newBidAmount + 50).toFixed(2)}`;
    }
}

/**
 * Add watchlist functionality to the watchlist button
 */
function initWatchlistButton(auctionId) {
  const watchlistBtn = document.querySelector('.watchlist-button');
  if (!watchlistBtn) return;
  
  // Get token to check if user is logged in
  const token = localStorage.getItem('token');
  if (!token) {
    // If not logged in, set up the button to redirect to login
    watchlistBtn.addEventListener('click', function() {
      window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
    });
    return;
  }
  
  // Check if item is already in watchlist
  checkWatchlistStatus(auctionId, watchlistBtn);
  
  // Add click handler
  watchlistBtn.addEventListener('click', async function() {
    try {
      const isInWatchlist = watchlistBtn.classList.contains('in-watchlist');
      
      if (isInWatchlist) {
        // Remove from watchlist
        await fetch(`http://localhost:5000/api/watchlist/${auctionId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token
          }
        });
        
        // Update button state
        watchlistBtn.classList.remove('in-watchlist');
        watchlistBtn.innerHTML = '<span>Add to Watchlist</span>';
        
        // Show message
        showBidMessage('Item removed from watchlist', 'success');
      } else {
        // Add to watchlist
        await fetch('http://localhost:5000/api/watchlist', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token
          },
          body: JSON.stringify({ auctionId })
        });
        
        // Update button state
        watchlistBtn.classList.add('in-watchlist');
        watchlistBtn.innerHTML = '<span>Remove from Watchlist</span>';
        
        // Show message
        showBidMessage('Item added to watchlist', 'success');
      }
    } catch (error) {
      console.error('Error updating watchlist:', error);
      showBidMessage('Failed to update watchlist', 'error');
    }
  });
}

/**
 * Check if item is in user's watchlist and update button accordingly
 */
async function checkWatchlistStatus(auctionId, watchlistBtn) {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    const response = await fetch(`http://localhost:5000/api/watchlist/check/${auctionId}`, {
      headers: {
        'x-auth-token': token
      }
    });
    
    const data = await response.json();
    
    if (data.inWatchlist) {
      watchlistBtn.classList.add('in-watchlist');
      watchlistBtn.innerHTML = '<span>Remove from Watchlist</span>';
    } else {
      watchlistBtn.classList.remove('in-watchlist');
      watchlistBtn.innerHTML = '<span>Add to Watchlist</span>';
    }
  } catch (error) {
    console.error('Error checking watchlist status:', error);
  }
}