document.addEventListener('DOMContentLoaded', function() {
    // Initial variables
    let currentPage = 1;
    const limitPerPage = 12;
    let currentSort = 'ending-soon';
    let currentFilter = {};
    
    // Elements
    const auctionGrid = document.querySelector('.auction-grid');
    const paginationContainer = document.querySelector('.pagination');
    const sortSelect = document.getElementById('sort');
    const searchInput = document.querySelector('.search-container input');
    const searchButton = document.querySelector('.search-button');
    const filterForm = document.querySelector('.filters');
    const resetButton = document.querySelector('.filters .btn-text');
    const applyFiltersBtn = document.querySelector('.filters .btn-primary');
    const minPriceInput = document.getElementById('min-price');
    const maxPriceInput = document.getElementById('max-price');
    const searchResultsIndicator = document.querySelector('.search-results-indicator');
    const searchTermDisplay = document.querySelector('.search-term');
    const clearSearchBtn = document.querySelector('.clear-search');
    
    // Parse URL parameters for initial filters
    parseUrlParams();
    
    // Initial load
    loadListings();
    
    // Event listeners
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            currentSort = this.value;
            currentPage = 1; // Reset to first page on sort change
            loadListings();
            updateUrlParams();
        });
    }
    
    if (searchButton) {
        searchButton.addEventListener('click', function() {
            const rawSearch = searchInput.value.trim();
            
            if (rawSearch) {
                currentFilter.search = rawSearch;
                currentPage = 1;
                loadListings();
                updateUrlParams();
                updateSearchIndicator();
            }
        });
        
        // Add search on Enter key press
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                // Same processing as above
                const rawSearch = this.value.trim();
                const processedSearch = preprocessSearch(rawSearch);
                
                searchInput.value = rawSearch;
                currentFilter.search = rawSearch;
                currentFilter.processedSearch = processedSearch;
                
                currentPage = 1;
                loadListings();
                updateUrlParams();
                updateSearchIndicator();
            }
        });
    }
    
    // Clear search button
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            // Clear search filter and input
            currentFilter.search = null;
            if (searchInput) searchInput.value = '';
            
            // Hide search indicator
            if (searchResultsIndicator) searchResultsIndicator.style.display = 'none';
            
            // Reset to page 1 and reload
            currentPage = 1;
            loadListings();
            updateUrlParams();
        });
    }
    
    // Apply filters button
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', function(e) {
            e.preventDefault();
            applyFilters();
        });
    }
    
    // Reset filters
    if (resetButton) {
        resetButton.addEventListener('click', function() {
            // Reset checkboxes
            filterForm.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
            });
            
            // Reset price inputs
            minPriceInput.value = '';
            maxPriceInput.value = '';
            
            // Reset radio buttons
            const allStatusRadio = filterForm.querySelector('input[value="all"]');
            if (allStatusRadio) {
                allStatusRadio.checked = true;
            }
            
            // Reset filter object
            currentFilter = {};
            currentPage = 1;
            
            // Hide search indicator
            if (searchResultsIndicator) searchResultsIndicator.style.display = 'none';
            
            // Reload listings
            loadListings();
            updateUrlParams();
        });
    }
    
    // Individual category checkbox changes
    const categoryCheckboxes = document.querySelectorAll('input[name="category"]');
    categoryCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            // If using auto-apply (uncomment this block to enable)
            // applyFilters();
        });
    });
    
    // View toggle
    const viewButtons = document.querySelectorAll('.view-btn');
    viewButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all buttons
            viewButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
            
            // Change view
            const viewType = this.getAttribute('data-view');
            if (viewType === 'grid') {
                auctionGrid.classList.remove('list-view');
            } else {
                auctionGrid.classList.add('list-view');
            }
            
            // Save view preference
            localStorage.setItem('preferred-view', viewType);
        });
    });
    
    // Load preferred view from localStorage
    const preferredView = localStorage.getItem('preferred-view');
    if (preferredView) {
        const viewBtn = document.querySelector(`.view-btn[data-view="${preferredView}"]`);
        if (viewBtn) {
            viewBtn.click();
        }
    }
    
    /**
     * Apply all selected filters
     */
    function applyFilters() {
        // Get category filters
        const categoryCheckboxes = filterForm.querySelectorAll('input[name="category"]:checked');
        const categories = Array.from(categoryCheckboxes).map(cb => cb.value);
        
        // Get price range
        const minPrice = minPriceInput.value;
        const maxPrice = maxPriceInput.value;
        
        // Get status filter
        const statusRadios = filterForm.querySelectorAll('input[name="status"]:checked');
        const status = statusRadios.length > 0 ? statusRadios[0].value : 'all';
        
        // Update filters
        currentFilter = {
            category: categories.length > 0 ? categories : null,
            minPrice: minPrice || null,
            maxPrice: maxPrice || null,
            status: status !== 'all' ? status : null,
            search: searchInput.value.trim() || null
        };
        
        currentPage = 1; // Reset to first page on filter change
        loadListings();
        updateUrlParams();
        updateSearchIndicator();
    }
    
    /**
     * Update search indicator based on current search
     */
    function updateSearchIndicator() {
        if (!searchResultsIndicator || !searchTermDisplay) return;
        
        if (currentFilter.search) {
            searchTermDisplay.textContent = currentFilter.search;
            
            // Add text explaining how the search works if the search has special characters
            if (currentFilter.search.includes('-') || currentFilter.search.includes('_')) {
                const helpText = document.querySelector('.search-help-text');
                if (!helpText) {
                    const helpSpan = document.createElement('small');
                    helpSpan.className = 'search-help-text';
                    helpSpan.textContent = " (We're looking for each word separately)";
                    searchResultsIndicator.querySelector('p').appendChild(helpSpan);
                }
            } else {
                const helpText = document.querySelector('.search-help-text');
                if (helpText) helpText.remove();
            }
            
            searchResultsIndicator.style.display = 'flex';
        } else {
            searchResultsIndicator.style.display = 'none';
        }
    }
    
    /**
     * Parse URL parameters to set initial filters
     */
    function parseUrlParams() {
        const params = new URLSearchParams(window.location.search);
        
        // Check for category parameter
        if (params.has('category')) {
            const categories = params.get('category').split(',');
            categories.forEach(category => {
                const checkbox = document.querySelector(`input[name="category"][value="${category}"]`);
                if (checkbox) checkbox.checked = true;
            });
            currentFilter.category = categories;
        }
        
        // Check for price range
        if (params.has('minPrice')) {
            const min = params.get('minPrice');
            minPriceInput.value = min;
            currentFilter.minPrice = min;
        }
        
        if (params.has('maxPrice')) {
            const max = params.get('maxPrice');
            maxPriceInput.value = max;
            currentFilter.maxPrice = max;
        }
        
        // Check for status
        if (params.has('status')) {
            const status = params.get('status');
            const statusRadio = document.querySelector(`input[name="status"][value="${status}"]`);
            if (statusRadio) statusRadio.checked = true;
            currentFilter.status = status;
        }
        
        // Check for search query
        if (params.has('search')) {
            const search = params.get('search');
            searchInput.value = search;
            currentFilter.search = search;
            updateSearchIndicator();
        }
        
        // Check for sort
        if (params.has('sort')) {
            currentSort = params.get('sort');
            if (sortSelect) sortSelect.value = currentSort;
        }
        
        // Check for page
        if (params.has('page')) {
            currentPage = parseInt(params.get('page')) || 1;
        }
    }
    
    /**
     * Update URL parameters based on current filters
     */
    function updateUrlParams() {
        const params = new URLSearchParams();
        
        // Add category
        if (currentFilter.category && currentFilter.category.length > 0) {
            params.set('category', currentFilter.category.join(','));
        }
        
        // Add price range
        if (currentFilter.minPrice) {
            params.set('minPrice', currentFilter.minPrice);
        }
        
        if (currentFilter.maxPrice) {
            params.set('maxPrice', currentFilter.maxPrice);
        }
        
        // Add status
        if (currentFilter.status) {
            params.set('status', currentFilter.status);
        }
        
        // Add search query
        if (currentFilter.search) {
            params.set('search', currentFilter.search);
        }
        
        // Add sort
        params.set('sort', currentSort);
        
        // Add page
        if (currentPage > 1) {
            params.set('page', currentPage.toString());
        }
        
        // Update URL without reloading the page
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        history.pushState({}, '', newUrl);
    }
    
    /**
     * Load listings from the API
     */
    function loadListings() {
        // Show loading state
        auctionGrid.innerHTML = '<div class="loading">Loading auctions...</div>';
        
        // Build URL with query parameters
        let url = `http://localhost:5000/api/auctions/listings?page=${currentPage}&limit=${limitPerPage}&sort=${currentSort}`;
        
        // Add filter parameters
        if (currentFilter.category) {
            url += `&category=${currentFilter.category.join(',')}`;
        }
        
        if (currentFilter.minPrice) {
            url += `&minPrice=${currentFilter.minPrice}`;
        }
        
        if (currentFilter.maxPrice) {
            url += `&maxPrice=${currentFilter.maxPrice}`;
        }
        
        if (currentFilter.search) {
            url += `&search=${encodeURIComponent(currentFilter.search)}`;
        }
        
        if (currentFilter.status && currentFilter.status === 'ending-soon') {
            url += '&ending=soon'; // API should handle this parameter
        } else if (currentFilter.status && currentFilter.status === 'newly-listed') {
            url += '&newly=true'; // API should handle this parameter
        }
        
        // Console log for debugging
        console.log('Fetching listings from:', url);
        
        // Fetch listings
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load listings');
                }
                return response.json();
            })
            .then(data => {
                console.log('API responded with:', data);
                
                // Check if there are no results immediately here
                if (!data.listings || data.listings.length === 0) {
                    // Handle no results case
                    if (currentFilter.search) {
                        // First update the search results indicator
                        const existingCount = document.querySelector('.search-results-count');
                        if (existingCount) {
                            existingCount.remove();
                        }
                        
                        if (searchResultsIndicator) {
                            const countSpan = document.createElement('span');
                            countSpan.className = 'search-results-count';
                            countSpan.textContent = 'No results found';
                            searchResultsIndicator.querySelector('p').appendChild(countSpan);
                        }
                        
                        // Now set the empty results message
                        auctionGrid.innerHTML = `
                            <div class="empty-search-message">
                                <h3>No results found for "${currentFilter.search}"</h3>
                                <p>Try different keywords or browse categories instead</p>
                                <a href="listings.html" class="btn-secondary">View All Listings</a>
                            </div>
                        `;
                    } else {
                        auctionGrid.innerHTML = '<div class="empty-message">No auctions found matching your criteria. Try adjusting your filters.</div>';
                    }
                    return; // Exit here, don't proceed to displayListings
                }
                
                // Only if we have listings, proceed to display them
                let searchTerms = [];
                if (currentFilter.search) {
                    const processedSearch = currentFilter.search.toLowerCase().replace(/[-_]/g, ' ');
                    searchTerms = processedSearch.split(/\s+/)
                        .filter(term => term.length > 2)
                        .map(term => term.trim())
                        .filter(term => term);
                }
                
                displayListings(data.listings, searchTerms);
                updatePagination(data.pagination);
                updateFilterCounts(data.facets);
                updateActiveFilters();
            })
            .catch(error => {
                console.error('Error loading listings:', error);
                
                if (currentFilter.search) {
                    auctionGrid.innerHTML = `
                        <div class="empty-search-message">
                            <h3>Error searching for "${currentFilter.search}"</h3>
                            <p>There was a problem with your search. Try different keywords or browse categories instead.</p>
                            <p><a href="listings.html" class="btn-text">Clear Search and View All Listings</a></p>
                        </div>
                    `;
                } else {
                    auctionGrid.innerHTML = '<div class="error-message">Failed to load auctions. Please try again later.</div>';
                }
            });
    }
    
    /**
     * Update category filter counts if API provides facet data
     */
    function updateFilterCounts(facets) {
        // If API doesn't provide facets, skip this
        if (!facets) return;
        
        // Update category counts if provided
        if (facets.categories) {
            document.querySelectorAll('input[name="category"]').forEach(checkbox => {
                const category = checkbox.value;
                const count = facets.categories[category] || 0;
                
                // Find or create the count element
                let countEl = checkbox.parentNode.querySelector('.category-count');
                if (!countEl) {
                    countEl = document.createElement('span');
                    countEl.className = 'category-count';
                    checkbox.parentNode.appendChild(countEl);
                }
                
                countEl.textContent = `(${count})`;
            });
        }
    }
    
    /**
     * Display listings in the grid
     */
    function displayListings(listings, searchTerms) {
        // First, clear any existing search results count
        const existingCount = document.querySelector('.search-results-count');
        if (existingCount) {
            existingCount.remove();
        }
        
        if (!listings || listings.length === 0) {
            // Handle empty results case...
            return;
        }
        
        // Clear grid
        auctionGrid.innerHTML = '';
        
        // Update search results count if search is active
        if (currentFilter.search && searchResultsIndicator) {
            const countSpan = document.createElement('span');
            countSpan.className = 'search-results-count';
            countSpan.textContent = `Found ${listings.length} result${listings.length !== 1 ? 's' : ''}`;
            searchResultsIndicator.querySelector('p').appendChild(countSpan);
        }
        
        // Get search terms for highlighting if there's a search
        // Make sure searchTerms is defined and has a default value
        let terms = searchTerms || [];
        if (currentFilter.search && (!terms || terms.length === 0)) {
            // Ensure we process terms locally if they weren't provided
            const processedSearch = currentFilter.search.toLowerCase().replace(/[-_]/g, ' ');
            terms = processedSearch.split(/\s+/)
                .filter(term => term.length > 2)
                .map(term => term.trim())
                .filter(term => term);
        }
        
        // Add each listing
        listings.forEach(listing => {
            const endDate = new Date(listing.ends_at);
            let imageUrl = 'https://picsum.photos/400/300?text=No+Image';
            
            // Image handling code...
            if (listing.images && Array.isArray(listing.images) && listing.images.length > 0) {
                imageUrl = listing.images[0];
            }
            
            // Create highlightable title
            let highlightedTitle = listing.title;
            // Only attempt highlighting if terms exists and has items
            if (terms && terms.length > 0) {
                terms.forEach(term => {
                    const regex = new RegExp(`(${term})`, 'gi');
                    highlightedTitle = highlightedTitle.replace(regex, '<span class="highlight">$1</span>');
                });
            }
            
            // Create auction item HTML...
            const auctionItem = document.createElement('div');
            auctionItem.className = 'auction-item';
            
            auctionItem.innerHTML = `
                <div class="auction-image">
                    <img src="${imageUrl}" alt="${listing.title}" onerror="this.src='https://picsum.photos/400/300?text=No+Image';">
                    <span class="time-left" data-ends="${endDate.toISOString()}">Loading...</span>
                </div>
                <div class="auction-details">
                    <h3>${highlightedTitle}</h3>
                    <p class="current-bid">Current Price: €${parseFloat(listing.current_bid).toFixed(2)}</p>
                    <p class="bids-count">${listing.bid_count || 0} bid${listing.bid_count !== 1 ? 's' : ''}</p>
                    <a href="item-details.html?id=${listing.id}" class="btn-secondary">View Details</a>
                </div>
            `;
            
            auctionGrid.appendChild(auctionItem);
        });
        
        // Initialize countdown timers
        initializeCountdowns();
    }
    
    /**
     * Update pagination controls
     */
    function updatePagination(pagination) {
        if (!pagination || !paginationContainer) return;
        
        // Clear pagination controls
        paginationContainer.innerHTML = '';
        
        // Previous button
        const prevBtn = document.createElement('button');
        prevBtn.className = `page-btn${pagination.hasPrevPage ? '' : ' disabled'}`;
        prevBtn.textContent = 'Previous';
        
        if (pagination.hasPrevPage) {
            prevBtn.addEventListener('click', () => {
                currentPage--;
                loadListings();
                window.scrollTo(0, 0);
            });
        }
        
        paginationContainer.appendChild(prevBtn);
        
        // Page buttons
        const totalPages = pagination.totalPages;
        const maxPageButtons = 5; // Maximum number of page buttons to show
        
        let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
        
        if (endPage - startPage + 1 < maxPageButtons && startPage > 1) {
            startPage = Math.max(1, endPage - maxPageButtons + 1);
        }
        
        // First page button if needed
        if (startPage > 1) {
            const firstBtn = document.createElement('button');
            firstBtn.className = 'page-btn';
            firstBtn.textContent = '1';
            firstBtn.addEventListener('click', () => {
                currentPage = 1;
                loadListings();
                window.scrollTo(0, 0);
            });
            paginationContainer.appendChild(firstBtn);
            
            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                paginationContainer.appendChild(ellipsis);
            }
        }
        
        // Page number buttons
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `page-btn${currentPage === i ? ' active' : ''}`;
            pageBtn.textContent = i;
            
            if (currentPage !== i) {
                pageBtn.addEventListener('click', () => {
                    currentPage = i;
                    loadListings();
                    window.scrollTo(0, 0);
                });
            }
            
            paginationContainer.appendChild(pageBtn);
        }
        
        // Last page button if needed
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                paginationContainer.appendChild(ellipsis);
            }
            
            const lastBtn = document.createElement('button');
            lastBtn.className = 'page-btn';
            lastBtn.textContent = totalPages;
            lastBtn.addEventListener('click', () => {
                currentPage = totalPages;
                loadListings();
                window.scrollTo(0, 0);
            });
            paginationContainer.appendChild(lastBtn);
        }
        
        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.className = `page-btn${pagination.hasNextPage ? '' : ' disabled'}`;
        nextBtn.textContent = 'Next';
        
        if (pagination.hasNextPage) {
            nextBtn.addEventListener('click', () => {
                currentPage++;
                loadListings();
                window.scrollTo(0, 0);
            });
        }
        
        paginationContainer.appendChild(nextBtn);
    }
    
    /**
     * Initialize countdown timers
     */
    function initializeCountdowns() {
        // Get all time-left elements
        const timeElements = document.querySelectorAll('.time-left');
        
        // Update each timer immediately and then every second
        timeElements.forEach(updateTimer);
        
        // Set interval to update timers every second
        setInterval(() => {
            timeElements.forEach(updateTimer);
        }, 1000);
    }
    
    /**
     * Update a single timer element
     */
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
    
    /**
     * Update active filters display
     */
    function updateActiveFilters() {
        const activeFiltersContainer = document.getElementById('active-filters');
        if (!activeFiltersContainer) return;
        
        activeFiltersContainer.innerHTML = '';
        let hasActiveFilters = false;
        
        // Add category filters
        if (currentFilter.category && currentFilter.category.length > 0) {
            currentFilter.category.forEach(category => {
                const filterTag = document.createElement('div');
                filterTag.className = 'filter-tag';
                filterTag.innerHTML = `Category: ${category} <span class="remove-filter" data-type="category" data-value="${category}">×</span>`;
                activeFiltersContainer.appendChild(filterTag);
                hasActiveFilters = true;
            });
        }
        
        // Add price range filters
        if (currentFilter.minPrice) {
            const filterTag = document.createElement('div');
            filterTag.className = 'filter-tag';
            filterTag.innerHTML = `Min Price: €${currentFilter.minPrice} <span class="remove-filter" data-type="minPrice">×</span>`;
            activeFiltersContainer.appendChild(filterTag);
            hasActiveFilters = true;
        }
        
        if (currentFilter.maxPrice) {
            const filterTag = document.createElement('div');
            filterTag.className = 'filter-tag';
            filterTag.innerHTML = `Max Price: €${currentFilter.maxPrice} <span class="remove-filter" data-type="maxPrice">×</span>`;
            activeFiltersContainer.appendChild(filterTag);
            hasActiveFilters = true;
        }
        
        // Add status filter
        if (currentFilter.status) {
            let statusText;
            switch(currentFilter.status) {
                case 'ending-soon': statusText = 'Ending Soon'; break;
                case 'newly-listed': statusText = 'Newly Listed'; break;
                default: statusText = currentFilter.status;
            }
            
            const filterTag = document.createElement('div');
            filterTag.className = 'filter-tag';
            filterTag.innerHTML = `Status: ${statusText} <span class="remove-filter" data-type="status">×</span>`;
            activeFiltersContainer.appendChild(filterTag);
            hasActiveFilters = true;
        }
        
        // Add event listeners to remove filters
        document.querySelectorAll('.remove-filter').forEach(el => {
            el.addEventListener('click', function() {
                const type = this.getAttribute('data-type');
                const value = this.getAttribute('data-value');
                
                if (type === 'category' && value) {
                    // Remove specific category
                    currentFilter.category = currentFilter.category.filter(cat => cat !== value);
                    if (currentFilter.category.length === 0) {
                        currentFilter.category = null;
                    }
                    
                    // Uncheck the corresponding checkbox
                    const checkbox = document.querySelector(`input[name="category"][value="${value}"]`);
                    if (checkbox) checkbox.checked = false;
                } else {
                    // Remove other filter types
                    currentFilter[type] = null;
                    
                    // Reset corresponding input
                    if (type === 'minPrice') minPriceInput.value = '';
                    if (type === 'maxPrice') maxPriceInput.value = '';
                    if (type === 'status') {
                        const allStatusRadio = document.querySelector('input[name="status"][value="all"]');
                        if (allStatusRadio) allStatusRadio.checked = true;
                    }
                }
                
                currentPage = 1;
                loadListings();
                updateUrlParams();
            });
        });
        
        // Show/hide the container based on whether there are active filters
        activeFiltersContainer.style.display = hasActiveFilters ? 'flex' : 'none';
    }
});

// Update this function to better handle search preprocessing
function preprocessSearch(searchQuery) {
  if (!searchQuery) return '';
  
  // Normalize the search query
  return searchQuery
    .toLowerCase()
    .replace(/[-_]/g, ' ')  // Replace hyphens/underscores with spaces
    .replace(/[^\w\s]/g, ' ')  // Replace non-alphanumeric chars with spaces
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .trim();
}

// Add this function to your listings.js file
function preprocessSearch(searchQuery) {
    // Normalize the search query
    // 1. Convert to lowercase
    // 2. Replace hyphens with spaces
    return searchQuery.toLowerCase().replace(/[-_]/g, ' ').trim();
}