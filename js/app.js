/**
 * Common functionality for BidMaster
 */
document.addEventListener('DOMContentLoaded', function() {
    // Tab switching functionality
    initTabSwitching();
    
    // Logout button functionality
    initLogoutButton();
});

/**
 * Initialize tab switching functionality
 */
function initTabSwitching() {
    // Get all tab buttons
    const tabButtons = document.querySelectorAll('.tab-button, .item-tab-button');
    
    // Add click event to each button
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Get the tab to show
            const tabId = this.getAttribute('data-tab');
            
            // Identify the correct button class
            const buttonSelector = this.classList.contains('item-tab-button') 
                ? '.item-tab-button' 
                : '.tab-button';
            
            // Identify the correct content class
            const contentSelector = this.classList.contains('item-tab-button')
                ? '.item-tab-content'
                : (document.querySelector('.bids-content') 
                    ? '.bids-content' 
                    : (document.querySelector('.listings-content') 
                        ? '.listings-content' 
                        : '.tab-content'));
            
            // Remove active class from all buttons in the same group
            document.querySelectorAll(buttonSelector).forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Remove active class from all content sections
            document.querySelectorAll('.tab-content, .bids-content, .listings-content, .item-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Add active class to clicked button and related content
            this.classList.add('active');
            const targetEl = document.getElementById(tabId);
            if (targetEl) {
                targetEl.classList.add('active');
            }
        });
    });
}

/**
 * Initialize logout button functionality
 */
function initLogoutButton() {
    const logoutBtn = document.getElementById('logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Clear authentication data
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            
            // Redirect to login page
            window.location.href = 'login.html';
        });
    }
}