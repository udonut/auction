/**
 * My Listings page functionality with pagination
 */
document.addEventListener('DOMContentLoaded', function() {
    // API URL
    const API_URL = 'http://localhost:5000/api/auctions';
    
    // Get token from local storage
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    // Pagination variables
    let currentPage = 1;
    const itemsPerPage = 10; // Display exactly 10 items per page
    let totalPages = 1;

    // Elements
    const listingsTable = document.querySelector('#active-listings .listings-table tbody');
    const endedTable = document.querySelector('#ended-listings .listings-table tbody');
    const unsoldTable = document.querySelector('#unsold-listings .listings-table tbody');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.listings-content');
    const sortSelect = document.getElementById('sort-listings');
    const summaryCards = document.querySelectorAll('.summary-card .summary-value');
    const searchInput = document.querySelector('.search-container input');
    const searchButton = document.querySelector('.search-button');
    const searchResultsIndicator = document.querySelector('.search-results-indicator');
    const searchTermDisplay = document.querySelector('.search-term');
    const clearSearchBtn = document.querySelector('.clear-search');
    let searchTerm = '';
    let originalListings = {
        active: [],
        scheduled: [],
        ended: [],
        unsold: []
    };
    
    // Store all listings by category
    let allListings = {
        active: [],
        scheduled: [],
        ended: [],
        unsold: []
    };
    
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
            
            // Reset to page 1 when switching tabs
            currentPage = 1;

            // --- Clear search when switching tabs ---
            if (searchInput) searchInput.value = '';
            searchTerm = '';
            if (searchResultsIndicator) searchResultsIndicator.style.display = 'none';
            allListings = JSON.parse(JSON.stringify(originalListings));

            // Refresh displayed items for the selected tab
            refreshCurrentTabDisplay();
        });
    });
    
    // Initial load
    fetchUserListings();
    
    // Add sort change handler
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            sortListings(this.value);
            refreshCurrentTabDisplay();
        });
    }
    
    // Add search event listeners
    if (searchButton) {
        searchButton.addEventListener('click', function() {
            performSearch();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
    
    /**
     * Fetch user listings from API
     */
    async function fetchUserListings() {
        try {
            // Show loading state for all tables
            if (listingsTable) listingsTable.innerHTML = '<tr><td colspan="6">Loading your listings...</td></tr>';
            if (endedTable) endedTable.innerHTML = '<tr><td colspan="6">Loading ended listings...</td></tr>';
            if (unsoldTable) unsoldTable.innerHTML = '<tr><td colspan="5">Loading unsold listings...</td></tr>';
            
            const response = await fetch(`${API_URL}/my-listings`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch listings');
            }
            
            const data = await response.json();
            console.log('User listings:', data);
            
            // Categorize all listings
            categorizeListings(data);
            
            // Display listings for current tab
            refreshCurrentTabDisplay();
            
            // Update summary statistics
            updateSummaryStats();
            
        } catch (error) {
            console.error('Error fetching listings:', error);
            showErrorMessage('Failed to load your listings. Please try again later.');
        }
    }
    
    /**
     * Categorize listings by status
     */
    function categorizeListings(listings) {
        allListings = { active: [], scheduled: [], ended: [], unsold: [] };
        originalListings = { active: [], scheduled: [], ended: [], unsold: [] };

        if (!listings || !Array.isArray(listings)) return;

        listings.forEach(listing => {
            const now = new Date();
            const endDate = new Date(listing.ends_at);
            
            // Check if auction has ended by time
            const isTimeEnded = endDate < now;
            
            // Check if auction is officially ended by status or time
            const isEnded = listing.status === 'ended' || isTimeEnded;
            
            // Check if the listing should go to unsold category
            const shouldBeUnsold = 
                listing.status === 'rejected' || 
                listing.status === 'more_info' ||
                (listing.status === 'pending_verification' && isTimeEnded) ||
                (isEnded && (!listing.buyer_id && !listing.final_price));

            if (listing.status === 'pending_verification' && !isTimeEnded) {
                // Pending verification and not expired - keep in scheduled
                allListings.scheduled.push(listing);
                originalListings.scheduled.push(listing);
            }
            else if (shouldBeUnsold) {
                // Should go to unsold tab
                allListings.unsold.push(listing);
                originalListings.unsold.push(listing);
            }
            else if (isEnded) {
                // Has ended and has a buyer - sold successfully
                if (listing.buyer_id || listing.final_price) {
                    allListings.ended.push(listing);
                    originalListings.ended.push(listing);
                } else {
                    // No buyer, so it's unsold
                    allListings.unsold.push(listing);
                    originalListings.unsold.push(listing);
                }
            } 
            else {
                // Truly active listings that haven't ended yet
                allListings.active.push(listing);
                originalListings.active.push(listing);
            }
        });

        updateTabCounts();
    }
    
    /**
     * Sort listings by selected criteria
     */
    function sortListings(sortCriteria) {
        const sortFunctions = {
            'ending-soon': (a, b) => new Date(a.ends_at) - new Date(b.ends_at),
            'recently-listed': (a, b) => new Date(b.created_at) - new Date(a.created_at),
            'most-bids': (a, b) => (b.bid_count || 0) - (a.bid_count || 0),
            'highest-price': (a, b) => parseFloat(b.current_bid || b.starting_price) - parseFloat(a.current_bid || a.starting_price)
        };
        
        const sortFunction = sortFunctions[sortCriteria] || sortFunctions['ending-soon'];
        
        // Sort each category of listings
        for (const key in allListings) {
            if (Array.isArray(allListings[key])) {
                allListings[key].sort(sortFunction);
            }
        }
    }
    
    /**
     * Get current active tab ID
     */
    function getCurrentTabId() {
        const activeTabContent = document.querySelector('.listings-content.active');
        return activeTabContent ? activeTabContent.id : 'active-listings';
    }
    
    /**
     * Refresh the display for the current active tab
     */
    function refreshCurrentTabDisplay() {
        const tabId = getCurrentTabId();
        let categoryKey, targetElement, paginationContainer;

        switch (tabId) {
            case 'active-listings':
                categoryKey = 'active';
                targetElement = listingsTable;
                paginationContainer = document.querySelector('#active-listings .pagination');
                break;
            case 'schedule-listings':
                categoryKey = 'scheduled';
                targetElement = document.querySelector('#schedule-listings .listings-table tbody');
                paginationContainer = document.querySelector('#schedule-listings .pagination');
                break;
            case 'ended-listings':
                categoryKey = 'ended';
                targetElement = endedTable;
                paginationContainer = document.querySelector('#ended-listings .pagination');
                break;
            case 'unsold-listings':
                categoryKey = 'unsold';
                targetElement = unsoldTable;
                paginationContainer = document.querySelector('#unsold-listings .pagination');
                break;
        }

        if (!categoryKey || !targetElement) return;

        const listings = allListings[categoryKey];
        totalPages = Math.ceil(listings.length / itemsPerPage) || 1;
        const paginated = paginate(listings, currentPage, itemsPerPage);

        targetElement.innerHTML = '';

        if (!listings || listings.length === 0) {
            targetElement.innerHTML = `<tr><td colspan="6">No listings found.</td></tr>`;
            if (paginationContainer) paginationContainer.innerHTML = '';
            return;
        }

        paginated.forEach(listing => {
            let row;
            if (tabId === 'schedule-listings') {
                row = createScheduledListingRow(listing);
            } else if (tabId === 'active-listings') {
                row = createListingRow(listing);
            } else if (tabId === 'ended-listings') {
                row = createEndedListingRow(listing);
            } else if (tabId === 'unsold-listings') {
                row = createUnsoldListingRow(listing);
            }
            if (row) targetElement.appendChild(row);
        });

        // Update pagination
        if (paginationContainer) updatePagination(tabId, totalPages);

        // Update countdowns for active tab
        if (tabId === 'active-listings') {
            initializeCountdowns();
        }
    }
    
    /**
     * Update pagination UI
     */
    function updatePagination(tabId, totalPages) {
        const paginationContainer = document.querySelector(`#${tabId} .pagination`);
        if (!paginationContainer) return;
        
        paginationContainer.innerHTML = '';
        
        // If only one page, don't show pagination
        if (totalPages <= 1) return;
        
        // Previous button
        const prevBtn = document.createElement('button');
        prevBtn.className = `page-btn${currentPage > 1 ? '' : ' disabled'}`;
        prevBtn.textContent = 'Previous';
        
        if (currentPage > 1) {
            prevBtn.addEventListener('click', () => {
                currentPage--;
                refreshCurrentTabDisplay();
                window.scrollTo(0, 0);
            });
        }
        
        paginationContainer.appendChild(prevBtn);
        
        // Page buttons
        const maxVisibleButtons = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisibleButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxVisibleButtons - 1);
        
        // Adjust start page if we're near the end
        if (endPage - startPage + 1 < maxVisibleButtons) {
            startPage = Math.max(1, endPage - maxVisibleButtons + 1);
        }
        
        // First page button if needed
        if (startPage > 1) {
            const firstBtn = document.createElement('button');
            firstBtn.className = 'page-btn';
            firstBtn.textContent = '1';
            firstBtn.addEventListener('click', () => {
                currentPage = 1;
                refreshCurrentTabDisplay();
                window.scrollTo(0, 0);
            });
            paginationContainer.appendChild(firstBtn);
            
            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'page-ellipsis';
                ellipsis.textContent = '...';
                paginationContainer.appendChild(ellipsis);
            }
        }
        
        // Numbered page buttons
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `page-btn${currentPage === i ? ' active' : ''}`;
            pageBtn.textContent = i;
            
            if (currentPage !== i) {
                pageBtn.addEventListener('click', () => {
                    currentPage = i;
                    refreshCurrentTabDisplay();
                    window.scrollTo(0, 0);
                });
            }
            
            paginationContainer.appendChild(pageBtn);
        }
        
        // Last page button if needed
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'page-ellipsis';
                ellipsis.textContent = '...';
                paginationContainer.appendChild(ellipsis);
            }
            
            const lastBtn = document.createElement('button');
            lastBtn.className = 'page-btn';
            lastBtn.textContent = totalPages;
            lastBtn.addEventListener('click', () => {
                currentPage = totalPages;
                refreshCurrentTabDisplay();
                window.scrollTo(0, 0);
            });
            paginationContainer.appendChild(lastBtn);
        }
        
        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.className = `page-btn${currentPage < totalPages ? '' : ' disabled'}`;
        nextBtn.textContent = 'Next';
        
        if (currentPage < totalPages) {
            nextBtn.addEventListener('click', () => {
                currentPage++;
                refreshCurrentTabDisplay();
                window.scrollTo(0, 0);
            });
        }
        
        paginationContainer.appendChild(nextBtn);
    }
    
    /**
     * Update the counts in the tab buttons
     */
    function updateTabCounts() {
        const activeTab = document.querySelector('[data-tab="active-listings"]');
        if (activeTab) activeTab.textContent = `Active (${allListings.active.length})`;

        const scheduleTab = document.querySelector('[data-tab="schedule-listings"]');
        if (scheduleTab) scheduleTab.textContent = `Scheduled (${allListings.scheduled.length})`;

        const endedTab = document.querySelector('[data-tab="ended-listings"]');
        if (endedTab) endedTab.textContent = `Ended (${allListings.ended.length})`;

        const unsoldTab = document.querySelector('[data-tab="unsold-listings"]');
        if (unsoldTab) unsoldTab.textContent = `Unsold (${allListings.unsold.length})`;
    }
    
    /**
     * Update the summary statistics
     */
    function updateSummaryStats() {
        if (!summaryCards || summaryCards.length < 3) return; // Changed from 4 to 3
        
        // Count active listings
        summaryCards[0].textContent = allListings.active.length;
        
        // Count completed sales
        const completedCount = allListings.ended.filter(listing => listing.sold).length;
        summaryCards[1].textContent = completedCount;
        
        // Calculate total sales - update index from 3 to 2
        const totalSales = allListings.ended
            .filter(listing => listing.sold)
            .reduce((sum, listing) => sum + parseFloat(listing.final_price || listing.current_bid || listing.starting_price || 0), 0);
        
        summaryCards[2].textContent = `€${totalSales.toFixed(2)}`; // Changed from 3 to 2
    }
    
    /**
     * Create a table row for a listing
     */
    function createListingRow(listing) {
        const row = document.createElement('tr');
        
        // Get the first image URL or use a placeholder
        let imageUrl = 'images/placeholder.jpg';
        if (listing.images && listing.images.length > 0) {
            if (typeof listing.images === 'string') {
                try {
                    const parsedImages = JSON.parse(listing.images);
                    imageUrl = Array.isArray(parsedImages) && parsedImages.length > 0 ? parsedImages[0] : imageUrl;
                } catch {
                    imageUrl = listing.images;
                }
            } else if (Array.isArray(listing.images) && listing.images.length > 0) {
                imageUrl = listing.images[0];
            }
        }
        
        // Calculate reserve status
       // Calculate reserve status
       let reserveStatus = '';
       if (listing.reserve_price) {
           const currentPrice = parseFloat(listing.current_bid || listing.starting_price);
           const reservePrice = parseFloat(listing.reserve_price);
           if (currentPrice >= reservePrice) {
               reserveStatus = '<p class="reserve-status met">Reserve met</p>';
           } else {
               reserveStatus = '<p class="reserve-status not-met">Reserve not met</p>';
           }
       }
        
        // Format the row HTML - Removed the Views column
        row.innerHTML = `
            <td class="item-cell">
                <div class="item-thumbnail">
                    <img src="${imageUrl}" alt="${listing.title}" onerror="this.src='images/placeholder.jpg'">
                </div>
                <div class="item-info">
                    <h4>${highlightSearchTerm(listing.title, searchTerm)}</h4>
                    <p class="item-id">ID: #${listing.id}</p>
                </div>
            </td>
            <td>
                <div class="price-info">
                    <p class="current-bid">€${parseFloat(listing.current_bid || listing.starting_price).toFixed(2)}</p>
                    ${reserveStatus}
                </div>
            </td>
            <td>${listing.bid_count || 0}</td>
            <td><span class="time-left" data-ends="${listing.ends_at}">Loading...</span></td>
            <td>
                <div class="listing-actions">
                    <a href="item-details.html?id=${listing.id}" class="btn-secondary">View</a>
                </div>
            </td>
        `;
        
        return row;
    }
    
    /**
     * Create a table row for an ended listing
     */
    function createEndedListingRow(listing) {
        const row = document.createElement('tr');
        
        // Get the first image URL or use a placeholder
        let imageUrl = 'images/placeholder.jpg';
        if (listing.images && listing.images.length > 0) {
            if (typeof listing.images === 'string') {
                try {
                    const parsedImages = JSON.parse(listing.images);
                    imageUrl = Array.isArray(parsedImages) && parsedImages.length > 0 ? parsedImages[0] : imageUrl;
                } catch {
                    imageUrl = listing.images;
                }
            } else if (Array.isArray(listing.images) && listing.images.length > 0) {
                imageUrl = listing.images[0];
            }
        }
        
        // Format status
        let statusDisplay = '';
        if (listing.buyer_id || listing.final_price) {
            // This is a sold item
            const soldClass = 'sold-status';
            statusDisplay = `<span class="${soldClass}">Sold</span>`;
        } else {
            // This is an unsold item that somehow ended up in the ended tab 
            // (shouldn't happen with our fix, but handling just in case)
            statusDisplay = '<span class="unsold-status">No Bids</span>';
        }
        
        // Format the row HTML
        row.innerHTML = `
            <td class="item-cell">
                <div class="item-thumbnail">
                    <img src="${imageUrl}" alt="${listing.title}" onerror="this.src='images/placeholder.jpg'">
                </div>
                <div class="item-info">
                    <h4>${highlightSearchTerm(listing.title, searchTerm)}</h4>
                    <p class="item-id">ID: #${listing.id}</p>
                </div>
            </td>
            <td>€${parseFloat(listing.starting_price).toFixed(2)}</td>
            <td>€${parseFloat(listing.final_price || listing.current_bid || listing.starting_price).toFixed(2)}</td>
            <td>${listing.bid_count || 0}</td>
            <td>${statusDisplay}</td>
            <td>
                <div class="listing-actions">
                    <a href="item-details.html?id=${listing.id}" class="btn-secondary">View</a>
                </div>
            </td>
        `;
        
        return row;
    }
    
    /**
     * Create a table row for an unsold listing
     */
    function createUnsoldListingRow(listing) {
        const row = document.createElement('tr');
        
        // Get the first image URL or use a placeholder
        let imageUrl = 'images/placeholder.jpg';
        if (listing.images && listing.images.length > 0) {
            if (typeof listing.images === 'string') {
                try {
                    const parsedImages = JSON.parse(listing.images);
                    imageUrl = Array.isArray(parsedImages) && parsedImages.length > 0 ? parsedImages[0] : imageUrl;
                } catch {
                    imageUrl = listing.images;
                }
            } else if (Array.isArray(listing.images) && listing.images.length > 0) {
                imageUrl = listing.images[0];
            }
        }
        
        // Format the date
        const endDate = new Date(listing.ends_at);
        const formattedDate = formatDate(endDate);
        
        // Get status display with improved logic
        let statusDisplay = '';
        let statusClass = '';
        
        switch (listing.status) {
            case 'active':
                // Check if there were bids - if so, it's "Not Sold" rather than "No Bids"
                if (listing.bid_count && listing.bid_count > 0) {
                    statusDisplay = 'Not Sold';
                    statusClass = 'status-not-sold';
                } else {
                    statusDisplay = 'No Bids';
                    statusClass = 'status-no-bids';
                }
                break;
            case 'rejected':
                statusDisplay = 'Rejected';
                statusClass = 'status-rejected';
                break;
            case 'pending_verification':
                statusDisplay = 'Verification Expired';
                statusClass = 'status-expired';
                break;
            case 'more_info':
                statusDisplay = 'More Info Needed';
                statusClass = 'status-more-info';
                break;
            default:
                statusDisplay = 'Unsold';
                statusClass = 'status-unsold';
        }
        
        // Format the row HTML
        row.innerHTML = `
            <td class="item-cell">
                <div class="item-thumbnail">
                    <img src="${imageUrl}" alt="${listing.title}" onerror="this.src='images/placeholder.jpg'">
                </div>
                <div class="item-info">
                    <h4>${highlightSearchTerm(listing.title, searchTerm)}</h4>
                    <p class="item-id">ID: #${listing.id}</p>
                </div>
            </td>
            <td>€${parseFloat(listing.starting_price).toFixed(2)}</td>
            <td><span class="status-badge ${statusClass}">${statusDisplay}</span></td>
            <td>${formattedDate}</td>
            <td>
                <div class="listing-actions">
                    <button class="btn-primary relist-btn" data-id="${listing.id}">Relist</button>
                </div>
            </td>
        `;
        
        return row;
    }

    /**
     * Create a table row for a scheduled listing
     */
    function createScheduledListingRow(listing) {
        const row = document.createElement('tr');
        let imageUrl = 'images/placeholder.jpg';
        if (listing.images && listing.images.length > 0) {
            imageUrl = listing.images[0];
        }
        const createdDate = new Date(listing.created_at);
        row.innerHTML = `
            <td class="item-cell">
                <div class="item-thumbnail">
                    <img src="${imageUrl}" alt="${listing.title}" onerror="this.src='images/placeholder.jpg'">
                </div>
                <div class="item-info">
                    <h4>${highlightSearchTerm(listing.title, searchTerm)}</h4>
                    <p class="item-id">ID: #${listing.id}</p>
                </div>
            </td>
            <td>€${parseFloat(listing.starting_price).toFixed(2)}</td>
            <td><span class="status-badge scheduled">Pending Verification</span></td>
            <td>${formatDate(createdDate)}</td>
            <td>
                <div class="listing-actions">
                    <a href="item-details.html?id=${listing.id}" class="btn-secondary">View</a>
                    <button class="btn-edit-scheduled edit-scheduled-btn" data-id="${listing.id}">Edit</button>
                    <button class="btn-remove-scheduled remove-scheduled-btn" data-id="${listing.id}">Remove</button>
                </div>
            </td>
        `;
        return row;
    }
    
    /**
     * Format a date for display
     */
    function formatDate(date) {
        return new Intl.DateTimeFormat('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric'
        }).format(date);
    }
    
    /**
     * Initialize countdown timers
     */
    function initializeCountdowns() {
        const timeElements = document.querySelectorAll('.time-left');
        
        timeElements.forEach(updateTimer);
        
        // Clear any existing interval
        if (window.countdownInterval) {
            clearInterval(window.countdownInterval);
        }
        
        // Set new interval
        window.countdownInterval = setInterval(() => {
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
            timeDisplay = `${days}d ${hours}h`;
        } else if (hours > 0) {
            timeDisplay = `${hours}h ${minutes}m`;
        } else {
            timeDisplay = `${minutes}m ${seconds}s`;
            
            if (minutes < 10) {
                element.classList.add('urgent');
            }
        }
        
        element.textContent = timeDisplay;
    }
    
    /**
     * Show an error message
     */
    function showErrorMessage(message) {
        // Find the active tab content
        const activeContent = document.querySelector('.listings-content.active');
        if (!activeContent) return;
        
        // Create error message element
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        // Insert at the top of the active content
        activeContent.prepend(errorDiv);
        
        // Remove after 5 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    /**
     * Perform search
     */
    function performSearch() {
        const term = searchInput.value.trim().toLowerCase();
        searchTerm = term;
        
        if (!term) {
            // If search is cleared, restore original listings
            allListings = JSON.parse(JSON.stringify(originalListings));
            currentPage = 1;
            if (searchResultsIndicator) searchResultsIndicator.style.display = 'none';
            refreshCurrentTabDisplay();
            return;
        }
        
        // Filter all categories
        for (const category in originalListings) {
            allListings[category] = originalListings[category].filter(listing => {
                return listing.title.toLowerCase().includes(term) || 
                       (listing.description && listing.description.toLowerCase().includes(term)) ||
                       (listing.category && listing.category.toLowerCase().includes(term));
            });
        }
        
        // Reset to first page
        currentPage = 1;
        updateSearchIndicator();
        // Update display
        refreshCurrentTabDisplay();
    }

    /**
     * Highlight search term
     */
    function highlightSearchTerm(text, term) {
        if (!term) return text;
        
        const regex = new RegExp('(' + term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + ')', 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
    }

    /**
     * Update search indicator
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

    // Add clear search button logic:
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            searchTerm = '';
            searchInput.value = '';
            if (searchResultsIndicator) searchResultsIndicator.style.display = 'none';
            currentPage = 1;
            allListings = JSON.parse(JSON.stringify(originalListings));
            refreshCurrentTabDisplay();
        });
    }

    // Add event delegation for relist buttons
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('relist-btn')) {
            const listingId = e.target.getAttribute('data-id');
            showRelistModal(listingId);
        }
    });
});

// Delegate click events for edit/remove in schedule tab
document.addEventListener('click', async function(e) {
    // Edit button
    if (e.target.classList.contains('edit-scheduled-btn')) {
        const listingId = e.target.getAttribute('data-id');
        // Fetch the listing data
        const listing = allListings.scheduled.find(l => l.id == listingId);
        if (listing) {
            // Save to localStorage for prefill
            localStorage.setItem('editListing', JSON.stringify(listing));
            window.location.href = 'create-listing.html?edit=1';
        }
    }

    // Remove button
    if (e.target.classList.contains('remove-scheduled-btn')) {
        const listingId = e.target.getAttribute('data-id');
        showRemoveModal(listingId);
    }
});

// Modal logic
function showRemoveModal(listingId) {
    // Create modal if not exists
    let modal = document.getElementById('remove-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'remove-modal';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0,0,0,0.4)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '9999';
        modal.innerHTML = `
            <div style="background:#fff;padding:2rem 2.5rem;border-radius:8px;max-width:350px;text-align:center;">
                <h3>Remove Listing?</h3>
                <p>Are you sure you want to remove this item from your schedule? If you wait a little more it may be active.</p>
                <div style="margin-top:1.5rem;">
                    <button id="confirm-remove-btn" class="btn-primary" style="margin-right:1rem;">Yes, Remove</button>
                    <button id="cancel-remove-btn" class="btn-secondary">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        modal.style.display = 'flex';
    }

    // Confirm remove
    modal.querySelector('#confirm-remove-btn').onclick = async function() {
        await removeScheduledListing(listingId);
        modal.style.display = 'none';
    };
    // Cancel
    modal.querySelector('#cancel-remove-btn').onclick = function() {
        modal.style.display = 'none';
    };
}

async function removeScheduledListing(listingId) {
    try {
        const response = await fetch(`http://localhost:5000/api/auctions/${listingId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            }
        });
        if (!response.ok) throw new Error('Failed to remove listing');
        // Remove from local data and refresh
        allListings.scheduled = allListings.scheduled.filter(l => l.id != listingId);
        originalListings.scheduled = originalListings.scheduled.filter(l => l.id != listingId);
        refreshCurrentTabDisplay();
        updateTabCounts();
    } catch (err) {
        alert('Failed to remove listing. Please try again.');
    }
}

// Helper to paginate an array
function paginate(array, page, perPage) {
    const start = (page - 1) * perPage;
    return array.slice(start, start + perPage);
}

/**
 * Show the relist modal for selecting auction duration
 */
function showRelistModal(listingId) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('relist-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'relist-modal';
        modal.className = 'modal-overlay';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Relist Auction</h2>
                </div>
                <div class="modal-body">
                    <p>Select a new duration for your auction. This listing will be submitted for approval again.</p>
                    
                    <div class="form-group">
                        <label for="relist-duration">Auction Duration*</label>
                        <select id="relist-duration" required>
                            <option value="1">1 day</option>
                            <option value="3">3 days</option>
                            <option value="5">5 days</option>
                            <option value="7" selected>7 days</option>
                            <option value="10">10 days</option>
                            <option value="14">14 days</option>
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="confirm-relist-btn" class="btn-primary">Relist Auction</button>
                    <button id="cancel-relist-btn" class="btn-secondary">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listeners for modal buttons
        document.getElementById('cancel-relist-btn').addEventListener('click', function() {
            modal.style.display = 'none';
        });
        
        // Close when clicking outside the modal
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    // Store the listing ID as a data attribute
    modal.setAttribute('data-listing-id', listingId);
    
    // Set up confirm button with the correct listing ID
    const confirmBtn = document.getElementById('confirm-relist-btn');
    confirmBtn.onclick = function() {
        const duration = document.getElementById('relist-duration').value;
        relistAuction(listingId, duration);
    };
    
    // Display the modal
    modal.style.display = 'flex';
}

/**
 * Process the relist action
 */
async function relistAuction(listingId, duration) {
    try {
        // Get token from local storage
        const token = localStorage.getItem('token');
        if (!token) {
            showErrorMessage('You must be logged in to relist an item.');
            return;
        }
        
        // Show loading state on the button
        const confirmBtn = document.getElementById('confirm-relist-btn');
        const originalBtnText = confirmBtn ? confirmBtn.textContent : 'Relist Auction'; // Store the original text
        
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Processing...';
        }
        
        // Call API to relist the auction
        const response = await fetch(`http://localhost:5000/api/auctions/${listingId}/relist`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify({ duration })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to relist auction');
        }
        
        // Hide modal
        const modal = document.getElementById('relist-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        // Show success message
        showSuccessMessage('Auction relisted successfully! It will be reviewed by our team before becoming active.');
        
        // Refresh listings to update UI - use existing function if available or add a new one
        if (typeof fetchUserListings === 'function') {
            fetchUserListings();
        } else {
            // Fallback: reload the page
            setTimeout(() => window.location.reload(), 1500);
        }
        
    } catch (error) {
        console.error('Error relisting auction:', error);
        showErrorMessage(error.message || 'Error relisting auction. Please try again.');
    } finally {
        // Reset button state
        const confirmBtn = document.getElementById('confirm-relist-btn');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = originalBtnText || 'Relist Auction';
        }
    }
}

/**
 * Show a success message
 */
function showSuccessMessage(message) {
    // Create a success message element
    const successEl = document.createElement('div');
    successEl.className = 'success-message';
    successEl.textContent = message;
    
    // Find the container to add it to
    const container = document.querySelector('.my-listings-container');
    
    // Insert at the top of the container
    container.insertBefore(successEl, container.firstChild);
    
    // Remove after 5 seconds
    setTimeout(() => {
        if (successEl.parentNode) {
            successEl.remove();
        }
    }, 5000);
}