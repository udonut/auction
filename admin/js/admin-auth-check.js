/**
 * Auth protection specifically for admin pages
 */
(function() {
    // Check if admin token exists
    const adminToken = localStorage.getItem('adminToken');
    const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
    
    // If no admin token or user is not admin, redirect to login
    if (!adminToken || adminUser.role !== 'admin') {
        window.location.href = 'admin-login.html';
        return;
    }
    
    // Update the admin username display section
    const adminUsername = document.querySelector('.admin-username');
    if (adminUsername) {
        // Extract the user data
        const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
        
        // Get the name (trying all possible property names)
        const fullName = adminUser.fullName || adminUser.name || adminUser.full_name || 'User';
        
        // Extract first name only
        const firstName = fullName.split(' ')[0];
        
        // Set the display text to "Admin [FirstName]"
        adminUsername.textContent = `Admin ${firstName}`;
        
        // Debug output
        console.log('Admin name data:', { adminUser, fullName, firstName });
    }
    
    // Verify token with server (optional but recommended for security)
    // This prevents users from faking admin access with localStorage manipulation
    fetch('http://localhost:5000/api/auth/verify-admin', {
        headers: {
            'x-auth-token': adminToken
        }
    })
    .then(response => {
        if (!response.ok) {
            // If server rejects the token, log user out
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            window.location.href = 'admin-login.html';
        }
    })
    .catch(error => {
        console.error('Token verification error:', error);
        // Allow access if server is down but token exists
    });
    
    // Logout functionality
    const logoutButton = document.getElementById('admin-logout');
    if (logoutButton) {
        logoutButton.addEventListener('click', function() {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            window.location.href = 'admin-login.html';
        });
    }
})();