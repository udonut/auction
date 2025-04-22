/**
 * Auth protection for secured pages
 */
(function() {
    // Check if token exists
    const token = localStorage.getItem('token');
    
    if (!token) {
        // If not on login or register page, redirect to login
        if (!window.location.href.includes('login.html') && 
            !window.location.href.includes('register.html') && 
            !window.location.href.includes('index.html')) {
            window.location.href = 'login.html';
        }
        
        // Hide user-specific elements
        document.querySelectorAll('.user-only').forEach(el => {
            el.style.display = 'none';
        });
        
        return;
    }
    
    // User is logged in
    
    // Get user data from localStorage
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    // Update username display - extract first name only
    const usernameElements = document.querySelectorAll('.username');
    if (usernameElements.length > 0) {
        // Get display name (fullName or name)
        const displayName = user.fullName || user.name || 'User';
        
        // Extract first name only
        const firstName = displayName.split(' ')[0];
        
        // Update all username elements
        usernameElements.forEach(element => {
            element.textContent = `Welcome, ${firstName}`;
        });
    }
    
    // Show admin link if user is an admin
    const dropdownContent = document.querySelector('.dropdown-content');
    if (dropdownContent && user.role === 'admin') {
        // Check if admin link already exists
        let adminLink = document.getElementById('admin-link');
        
        // If admin link doesn't exist, create it
        if (!adminLink) {
            adminLink = document.createElement('a');
            adminLink.id = 'admin-link';
            adminLink.href = 'admin/admin-dashboard.html';
            adminLink.textContent = 'Admin Dashboard';
            
            // Insert before logout link
            const logoutLink = document.getElementById('logout');
            if (logoutLink) {
                dropdownContent.insertBefore(adminLink, logoutLink);
            } else {
                dropdownContent.appendChild(adminLink);
            }
        } else {
            // Make sure the existing link is visible
            adminLink.style.display = 'block';
        }
    }
    
    // Setup logout functionality
    const logoutLink = document.getElementById('logout');
    if (logoutLink) {
        logoutLink.addEventListener('click', function(e) {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        });
    }
})();