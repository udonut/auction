/**
 * Handles the auction review page functionality
 */
document.addEventListener('DOMContentLoaded', function() {
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
        window.location.href = 'admin-login.html';
        return;
    }
    
    // Get auction ID from URL
    const auctionId = getAuctionIdFromUrl();
    if (!auctionId) {
        showError('No auction ID specified');
        return;
    }
    
    // Load auction details
    loadAuctionDetails(auctionId);
    
    // Handle image thumbnails
    const thumbnails = document.querySelectorAll('.thumbnail');
    const mainImage = document.querySelector('.main-image img');
    
    thumbnails.forEach(thumbnail => {
        thumbnail.addEventListener('click', function() {
            // Remove active class from all thumbnails
            thumbnails.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked thumbnail
            this.classList.add('active');
            
            // Update main image
            const thumbnailImg = this.querySelector('img');
            mainImage.src = thumbnailImg.src;
        });
    });
    
    // Handle verification status changes
    const verificationStatus = document.getElementById('verification-status');
    const rejectionReason = document.querySelector('.rejection-reason');
    const rejectionMessage = document.querySelector('.rejection-message');
    
    verificationStatus.addEventListener('change', function() {
        if (this.value === 'reject') {
            rejectionReason.style.display = 'block';
            rejectionMessage.style.display = 'block';
        } else {
            rejectionReason.style.display = 'none';
            rejectionMessage.style.display = 'none';
        }
    });
    
    // Handle decision submission
    const submitDecisionBtn = document.querySelector('.decision-actions .btn-primary');
    
    // Update the decision submission event handler
    submitDecisionBtn.addEventListener('click', function() {
        // Disable the button to prevent multiple submissions
        submitDecisionBtn.disabled = true;
        submitDecisionBtn.textContent = 'Submitting...';
        
        const status = verificationStatus.value === 'approve' ? 'active' : 
                      (verificationStatus.value === 'reject' ? 'rejected' : 
                      (verificationStatus.value === 'pending' ? 'more_info' : 'pending_verification'));
        const adminNotes = document.getElementById('admin-notes').value;
        let reason = null;
        let message = null;
        
        if (status === 'rejected') {
            reason = document.getElementById('rejection-reason').value;
            message = document.getElementById('seller-message').value;
            
            if (!reason) {
                showNotification('Please select a rejection reason', 'error');
                submitDecisionBtn.disabled = false;
                submitDecisionBtn.textContent = 'Submit Decision';
                return;
            }
            
            if (!message) {
                showNotification('Please provide a message to the seller', 'error');
                submitDecisionBtn.disabled = false;
                submitDecisionBtn.textContent = 'Submit Decision';
                return;
            }
        }
        
        // Prepare data to send to the server
        const decisionData = {
            status,
            adminNotes,
            reason,
            message
        };
        
        // Send decision to the server
        fetch(`http://localhost:5000/api/auctions/admin/verify/${auctionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': adminToken
            },
            body: JSON.stringify(decisionData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                // Get seller name from the page
                const sellerName = document.querySelector('.seller-details h4').textContent;
                const firstName = sellerName.split(' ')[0];
                
                // Show notification with status and seller name
                let statusText;
                let notificationType;
                
                if (status === 'active') {
                    statusText = 'Approved';
                    notificationType = 'success';
                } else if (status === 'rejected') {
                    statusText = 'Rejected';
                    notificationType = 'rejected';
                } else {
                    statusText = 'More information requested';
                    notificationType = 'pending';
                }
                
                // Show notification with seller's first name
                showDecisionNotification(`Review sent to ${firstName}: ${statusText}`, notificationType);
                
                // Scroll to notification
                document.getElementById('decision-notification').scrollIntoView({ behavior: 'smooth' });
            } else {
                showDecisionNotification('Error: ' + (data.message || 'Failed to submit decision'), 'error');
                
                // Re-enable button on error
                submitDecisionBtn.disabled = false;
                submitDecisionBtn.textContent = 'Submit Decision';
            }
        })
        .catch(error => {
            console.error('Error submitting decision:', error);
            showDecisionNotification('Failed to submit decision. Please try again.', 'error');
            
            // Re-enable button on error
            submitDecisionBtn.disabled = false;
            submitDecisionBtn.textContent = 'Submit Decision';
        });
    });
    
    /**
     * Extract auction ID from URL query parameters
     */
    function getAuctionIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }
    
    /**
     * Load auction details from API
     */
    function loadAuctionDetails(auctionId) {
        fetch(`http://localhost:5000/api/auctions/admin/${auctionId}`, {
            headers: {
                'x-auth-token': adminToken
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load auction details');
            }
            return response.json();
        })
        .then(auction => {
            populateAuctionDetails(auction);
        })
        .catch(error => {
            console.error('Error loading auction details:', error);
            showError(`Error loading auction details: ${error.message}`);
        });
    }
    
    /**
     * Populate the page with auction details
     */
    function populateAuctionDetails(auction) {
        // Update page title
        document.querySelector('.review-header h1').textContent = `Review Auction #${auction.id}`;
        
        // Update main image
        const mainImageEl = document.querySelector('.main-image img');
        if (auction.images && auction.images.length > 0) {
            mainImageEl.src = auction.images[0];
            mainImageEl.alt = auction.title;
        }
        
        // Add error handling for main image
        if (mainImageEl) {
            mainImageEl.onerror = function() { handleImageError(this); };
        }
        
        // Update thumbnails
        const thumbnailGallery = document.querySelector('.thumbnail-gallery');
        thumbnailGallery.innerHTML = ''; // Clear existing thumbnails
        
        if (auction.images && auction.images.length > 0) {
            auction.images.forEach((image, index) => {
                const thumbnailDiv = document.createElement('div');
                thumbnailDiv.className = index === 0 ? 'thumbnail active' : 'thumbnail';
                
                const thumbnailImg = document.createElement('img');
                thumbnailImg.src = image;
                thumbnailImg.alt = `${auction.title} - Image ${index + 1}`;
                
                thumbnailDiv.appendChild(thumbnailImg);
                thumbnailGallery.appendChild(thumbnailDiv);
                
                // Add click handler
                thumbnailDiv.addEventListener('click', function() {
                    document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    mainImageEl.src = image;
                });
            });
        }
        
        // Update auction details
        const detailsSection = document.querySelector('.auction-details');
        detailsSection.innerHTML = `
            <div class="detail-row">
                <span class="detail-label">Title</span>
                <span class="detail-value">${auction.title}</span>
            </div>
            
            <div class="detail-row">
                <span class="detail-label">Category</span>
                <span class="detail-value">${auction.category}</span>
            </div>
            
            <div class="detail-row">
                <span class="detail-label">Condition</span>
                <span class="detail-value">${auction.item_condition}</span>
            </div>
            
            <div class="detail-row">
                <span class="detail-label">Starting Price</span>
                <span class="detail-value">€${parseFloat(auction.starting_price).toFixed(2)}</span>
            </div>
            
            <div class="detail-row">
                <span class="detail-label">Reserve Price</span>
                <span class="detail-value">${auction.reserve_price ? '€' + parseFloat(auction.reserve_price).toFixed(2) : 'None'}</span>
            </div>
            
            <div class="detail-row">
                <span class="detail-label">Duration</span>
                <span class="detail-value">${formatDuration(auction.duration)}</span>
            </div>
            
            <div class="detail-row">
                <span class="detail-label">Shipping Options</span>
                <span class="detail-value">${formatShippingOptions(auction.shipping_options)}</span>
            </div>
            
            <div class="detail-row">
                <span class="detail-label">Date Submitted</span>
                <span class="detail-value">${formatDate(auction.created_at)}</span>
            </div>
        `;
        
        // Update item description
        document.querySelector('.item-description').innerHTML = `
            <h3>Item Description</h3>
            ${formatDescription(auction.description)}
        `;
        
        // Update seller information
        const sellerCreatedDate = formatDate(auction.seller_joined);
        document.querySelector('.seller-information').innerHTML = `
            <h3>Seller Information</h3>
            
            <div class="seller-profile">
                <div class="seller-avatar">${getInitials(auction.seller_name)}</div>
                <div class="seller-details">
                    <h4>${auction.seller_name}</h4>
                    <div class="seller-meta">
                        <span class="seller-joined">Member since: ${sellerCreatedDate}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Show error message
     */
    function showError(message) {
        const mainContent = document.querySelector('.review-grid');
        if (mainContent) {
            mainContent.innerHTML = `<div class="error-message">${message}</div>`;
        }
    }
    
    /**
     * Format shipping options array to readable string
     */
    function formatShippingOptions(options) {
        if (!options || !Array.isArray(options) || options.length === 0) {
            return 'None specified';
        }
        
        const formatted = options.map(option => {
            if (option === 'domestic') return 'Domestic Shipping';
            if (option === 'international') return 'International Shipping';
            if (option === 'pickup') return 'Local Pickup';
            return option;
        });
        
        return formatted.join(', ');
    }
    
    /**
     * Format description with paragraphs
     */
    function formatDescription(description) {
        if (!description) return '<p>No description provided.</p>';
        
        // Split by new lines and wrap in paragraph tags
        const paragraphs = description.split('\n').filter(p => p.trim() !== '');
        return paragraphs.map(p => `<p>${p}</p>`).join('');
    }
    
    /**
     * Format date to readable string
     */
    function formatDate(dateString) {
        if (!dateString) return 'Unknown';
        
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        }).format(date);
    }
    
    /**
     * Get initials from name
     */
    function getInitials(name) {
        if (!name) return '??';
        
        return name.split(' ')
            .map(part => part.charAt(0))
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }
    
    /**
     * Handle image error
     */
    function handleImageError(img) {
        img.onerror = null;  // Prevent infinite loop
        img.src = "https://via.placeholder.com/800x600?text=No+Image+Available";
    }
    
    /**
     * Show decision notification
     */
    function showDecisionNotification(message, type) {
        const notification = document.getElementById('decision-notification');
        const messageEl = notification.querySelector('.notification-message');
        
        // Remove any existing classes
        notification.className = 'decision-notification';
        
        // Add specific class based on type
        if (type === 'success') {
            notification.classList.add('notification-success');
        } else if (type === 'rejected') {
            notification.classList.add('notification-rejected');
        } else if (type === 'pending') {
            notification.classList.add('notification-pending');
        } else {
            notification.classList.add('notification-rejected'); // Use rejected as default error style
        }
        
        // Set the message
        messageEl.textContent = message;
        
        // Show the notification
        notification.style.display = 'block';
        
        // Add event listener to the return to queue button
        const returnButton = notification.querySelector('.return-to-queue');
        returnButton.addEventListener('click', function() {
            window.location.href = 'admin-verification.html';
        });
    }
    
    // Add this function for form validation errors
    function showNotification(message, type) {
        // You could show a smaller notification for form errors
        alert(message); // For now, just keeping the alert for validation errors
    }
});

/**
 * Format duration to appropriate units (days, hours, minutes)
 */
function formatDuration(duration) {
    if (!duration && duration !== 0) return 'Unknown';
    
    // Convert duration to a number to be safe
    const durationNum = parseFloat(duration);
    
    if (isNaN(durationNum)) return 'Invalid duration';
    
    // Format based on value
    if (durationNum >= 1) {
        // 1 or more days
        return durationNum === 1 ? '1 day' : `${durationNum} days`;
    } else if (durationNum >= 1/24) {
        // Convert to hours (1/24 day = 1 hour)
        const hours = Math.round(durationNum * 24);
        return hours === 1 ? '1 hour' : `${hours} hours`;
    } else if (durationNum >= 1/1440) {
        // Convert to minutes (1/1440 day = 1 minute)
        const minutes = Math.round(durationNum * 24 * 60);
        return minutes === 1 ? '1 minute' : `${minutes} minutes`;
    } else {
        // Convert to seconds
        const seconds = Math.round(durationNum * 24 * 60 * 60);
        return seconds === 1 ? '1 second' : `${seconds} seconds`;
    }
}