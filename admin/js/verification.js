/**
 * Handles admin verification functionality with pagination
 */
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the verification page
    const verificationTable = document.querySelector('.verification-queue table tbody');
    if (!verificationTable) return;
    
    // Get admin token
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
        window.location.href = 'admin-login.html';
        return;
    }
    
    // Initialize pagination state
    let currentPage = 1;
    const itemsPerPage = 10;
    
    // Declare the timeout variable at the top level
    let loadPendingVerificationsTimeout = null;
    
    // Load pending verification auctions for current page
    loadPendingVerifications(currentPage);
    
    // Set up filter functionality
    const filterForm = document.querySelector('.verification-filters');
    if (filterForm) {
        const filterButton = filterForm.querySelector('.btn-primary');
        filterButton.addEventListener('click', function() {
            // Reset to first page when applying filters
            currentPage = 1;
            loadPendingVerifications(currentPage);
        });
    }
    
    // Function to load pending verifications with debouncing
    function loadPendingVerifications(page) {
        // Clear any pending timeouts
        if (loadPendingVerificationsTimeout) {
            clearTimeout(loadPendingVerificationsTimeout);
        }
        
        // Show loading state immediately
        verificationTable.innerHTML = '<tr><td colspan="7" class="loading-message">Loading auctions...</td></tr>';
        
        // Get filter values BEFORE defining fetchWithRetry
        let filterDate = document.getElementById('filter-date')?.value || 'all';
        let filterCategory = document.getElementById('filter-category')?.value || 'all';
        
        let retryCount = 0;
        const maxRetries = 3;
        const baseDelay = 1000;
        
        // Define fetchWithRetry function after declaring the variables it needs
        function fetchWithRetry() {
            // Construct the URL with pagination and filter parameters
            let apiUrl = `http://localhost:5000/api/auctions/admin/verification?page=${page}&limit=${itemsPerPage}`;
            
            // Add filter parameters if needed
            if (filterDate !== 'all') apiUrl += `&date=${filterDate}`;
            if (filterCategory !== 'all') apiUrl += `&category=${filterCategory}`;
            
            
            
            // Fetch from API
            fetch(apiUrl, {
                headers: {
                    'x-auth-token': adminToken
                }
            })
            .then(response => {
                
                if (!response.ok) {
                    if (response.status === 429) {
                        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
                    }
                    throw new Error('Failed to load verification data. Status: ' + response.status);
                }
                return response.json();
            })
            .then(data => {
                // Reset retry count on success
                retryCount = 0;
                
                // Process auctions
                const auctions = data.auctions || [];
                const pagination = data.pagination || {};
                
                if (auctions.length === 0) {
                    verificationTable.innerHTML = '<tr><td colspan="7" class="empty-message">No auctions pending verification</td></tr>';
                    // Hide pagination if no results
                    document.querySelector('.pagination').style.display = 'none';
                    return;
                }
                
                // Show pagination
                document.querySelector('.pagination').style.display = 'flex';
                
                // Clear table
                verificationTable.innerHTML = '';
                
                // Add each auction to table
                auctions.forEach(auction => {
                    const row = createAuctionRow(auction);
                    verificationTable.appendChild(row);
                });
                
                // Initialize grace period timers
                initGraceTimers();
                
                // Update pagination controls
                updatePaginationControls(pagination);
            })
            .catch(error => {
                // Error handling...
            });
        }
        
        // Delay the actual fetch by 300ms to prevent rapid consecutive calls
        loadPendingVerificationsTimeout = setTimeout(() => {
            // Call fetchWithRetry
            fetchWithRetry();
        }, 300);
    }
    
    /**
     * Update pagination controls based on API response
     */
    function updatePaginationControls(pagination) {
        const paginationElement = document.querySelector('.pagination');
        if (!paginationElement) return;
        
        // Clear existing pagination elements
        paginationElement.innerHTML = '';
        
        // Previous button
        const prevButton = document.createElement('button');
        prevButton.className = 'page-btn' + (pagination.hasPrevPage ? '' : ' disabled');
        prevButton.textContent = 'Previous';
        prevButton.disabled = !pagination.hasPrevPage;
        if (pagination.hasPrevPage) {
            prevButton.addEventListener('click', function() {
                currentPage--;
                loadPendingVerifications(currentPage);
            });
        }
        paginationElement.appendChild(prevButton);
        
        // Page buttons
        const totalPages = pagination.totalPages || 1;
        const maxVisiblePages = 5; // Maximum number of page buttons to show
        
        let startPage = Math.max(1, pagination.page - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        // Adjust start page if we're near the end
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        // First page button if not visible
        if (startPage > 1) {
            const firstPageButton = document.createElement('button');
            firstPageButton.className = 'page-btn';
            firstPageButton.textContent = '1';
            firstPageButton.addEventListener('click', function() {
                currentPage = 1;
                loadPendingVerifications(currentPage);
            });
            paginationElement.appendChild(firstPageButton);
            
            // Add ellipsis if there's a gap
            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'pagination-ellipsis';
                ellipsis.textContent = '...';
                paginationElement.appendChild(ellipsis);
            }
        }
        
        // Page number buttons
        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.className = 'page-btn' + (i === pagination.page ? ' active' : '');
            pageButton.textContent = i.toString();
            
            if (i !== pagination.page) {
                pageButton.addEventListener('click', function() {
                    currentPage = i;
                    loadPendingVerifications(currentPage);
                });
            }
            
            paginationElement.appendChild(pageButton);
        }
        
        // Last page button if not visible
        if (endPage < totalPages) {
            // Add ellipsis if there's a gap
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'pagination-ellipsis';
                ellipsis.textContent = '...';
                paginationElement.appendChild(ellipsis);
            }
            
            const lastPageButton = document.createElement('button');
            lastPageButton.className = 'page-btn';
            lastPageButton.textContent = totalPages.toString();
            lastPageButton.addEventListener('click', function() {
                currentPage = totalPages;
                loadPendingVerifications(currentPage);
            });
            paginationElement.appendChild(lastPageButton);
        }
        
        // Next button
        const nextButton = document.createElement('button');
        nextButton.className = 'page-btn' + (pagination.hasNextPage ? '' : ' disabled');
        nextButton.textContent = 'Next';
        nextButton.disabled = !pagination.hasNextPage;
        if (pagination.hasNextPage) {
            nextButton.addEventListener('click', function() {
                currentPage++;
                loadPendingVerifications(currentPage);
            });
        }
        paginationElement.appendChild(nextButton);
    }
    
    /**
     * Filter auctions based on selected filters
     */
    function filterAuctions(auctions, dateFilter, categoryFilter, sellerFilter) {
        return auctions.filter(auction => {
            // Date filter
            if (dateFilter !== 'all') {
                const createdDate = new Date(auction.created_at);
                const today = new Date();
                
                if (dateFilter === 'today') {
                    if (createdDate.toDateString() !== today.toDateString()) return false;
                } else if (dateFilter === 'yesterday') {
                    const yesterday = new Date(today);
                    yesterday.setDate(today.getDate() - 1);
                    if (createdDate.toDateString() !== yesterday.toDateString()) return false;
                } else if (dateFilter === 'week') {
                    const weekAgo = new Date(today);
                    weekAgo.setDate(today.getDate() - 7);
                    if (createdDate < weekAgo) return false;
                } else if (dateFilter === 'month') {
                    const monthAgo = new Date(today);
                    monthAgo.setMonth(today.getMonth() - 1);
                    if (createdDate < monthAgo) return false;
                }
            }
            
            // Category filter
            if (categoryFilter !== 'all' && auction.category !== categoryFilter) {
                return false;
            }
            
            // We'd need additional data for seller filtering
            // For now, we'll just return true for this filter
            
            return true;
        });
    }
    
    /**
     * Create HTML for an auction row
     */
    function createAuctionRow(auction) {
        const tr = document.createElement('tr');
        
        // Format time
        const createdDate = new Date(auction.created_at);
        const timeAgo = formatTimeAgo(createdDate);
        
        // Create image URL - use first image or placeholder
        const imageUrl = auction.images && auction.images.length > 0 
            ? auction.images[0] 
            : 'https://via.placeholder.com/100x100?text=No+Image';
        
        // Determine status display and class based on current status
        let statusDisplay = '';
        let statusClass = '';
        
        // Update the switch statement to check specifically for more_info
        switch(auction.status) {
            case 'pending_verification':
                statusDisplay = 'Pending';
                statusClass = 'pending';
                break;
            case 'active':
                statusDisplay = 'Accepted';
                statusClass = 'approved';
                break;
            case 'rejected':
                statusDisplay = 'Rejected';
                statusClass = 'rejected';
                break;
            case 'more_info':
                statusDisplay = 'More Info';
                statusClass = 'more-info';
                break;
            default:
                statusDisplay = 'Unknown';
                statusClass = 'pending';
        }
        
        // If it was verified recently, calculate time remaining in grace period
        let graceTimeRemaining = '';
        
        if (auction.verified_at && auction.status !== 'pending_verification') {
            const verifiedAt = new Date(auction.verified_at);
            const expiresAt = new Date(verifiedAt.getTime() + 5 * 60 * 1000); // 5 minutes
            const now = new Date();
            
            if (expiresAt > now) {
                const timeLeftMs = expiresAt - now;
                const minsLeft = Math.floor(timeLeftMs / 60000);
                const secsLeft = Math.floor((timeLeftMs % 60000) / 1000);
                
                graceTimeRemaining = `<span class="grace-timer" data-expires="${expiresAt.toISOString()}">
                                        ${minsLeft}:${secsLeft < 10 ? '0' + secsLeft : secsLeft}
                                      </span>`;
            }
        }
        
        tr.innerHTML = `
            <td>#${auction.id}</td>
            <td>
                <div class="auction-cell">
                    <div class="auction-thumb">
                        <img src="${imageUrl}" alt="${auction.title}">
                    </div>
                    <div class="auction-info">
                        <strong>${auction.title}</strong>
                        <span>Category: ${auction.category}</span>
                    </div>
                </div>
            </td>
            <td>
                <div class="seller-info">
                    <span class="seller-name">${auction.seller_name || 'Unknown Seller'}</span>
                </div>
            </td>
            <td>€${parseFloat(auction.starting_price).toFixed(2)}</td>
            <td>${timeAgo}</td>
            <td><span class="status ${statusClass}">${statusDisplay}</span> ${graceTimeRemaining}</td>
            <td>
                <div class="action-buttons">
                    <a href="admin-auction-review.html?id=${auction.id}" class="btn-secondary">Review</a>
                </div>
            </td>
        `;
        
        // If the auction is high value (over $1000), add highlight class
        if (parseFloat(auction.starting_price) > 1000) {
            tr.classList.add('priority-high');
        }
        
        // If the auction has been decided recently, add a grace period class
        if (auction.verified_at && auction.status !== 'pending_verification') {
            tr.classList.add('grace-period');
        }
        
        return tr;
    }
    
    /**
     * Format time ago string
     */
    function formatTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffDays > 0) {
            return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else if (diffHours > 0) {
            return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else if (diffMinutes > 0) {
            return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
        } else {
            return `${diffSeconds} second${diffSeconds !== 1 ? 's' : ''} ago`;
        }
    }
    
    /**
     * Initialize grace period timers
     */
    function initGraceTimers() {
        const timers = document.querySelectorAll('.grace-timer');
        
        timers.forEach(timer => {
            const updateTimer = () => {
                const expiresAt = new Date(timer.dataset.expires);
                const now = new Date();
                const timeLeftMs = expiresAt - now;
                
                if (timeLeftMs <= 0) {
                    // Time expired, refresh the page
                    loadPendingVerifications(currentPage);
                    return;
                }
                
                // Update timer display
                const minsLeft = Math.floor(timeLeftMs / 60000);
                const secsLeft = Math.floor((timeLeftMs % 60000) / 1000);
                timer.textContent = `${minsLeft}:${secsLeft < 10 ? '0' + secsLeft : secsLeft}`;
                
                // Continue updating
                setTimeout(updateTimer, 1000);
            };
            
            // Start the update cycle
            updateTimer();
        });
    }
});