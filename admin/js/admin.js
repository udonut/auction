/**
 * Common functionality for admin interface
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin.js loaded successfully');
    
    // Handle logout button click
    const logoutBtn = document.getElementById('admin-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            window.location.href = 'admin-login.html';
        });
    }
    
    // Handle "View Main Site" link click to sync admin credentials
    const viewMainSiteBtn = document.querySelector('a[href="../index.html"]');
    if (viewMainSiteBtn) {
        viewMainSiteBtn.addEventListener('click', function(e) {
            // Get admin user data
            const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
            const adminToken = localStorage.getItem('adminToken');
            
            // If we have valid admin credentials
            if (adminUser && adminUser.role === 'admin' && adminToken) {
                // Also store these credentials in the format the main site expects
                localStorage.setItem('token', adminToken);
                localStorage.setItem('user', JSON.stringify({
                    id: adminUser.id || 1,
                    email: adminUser.email,
                    fullName: adminUser.fullName || adminUser.name || 'Admin User',
                    role: 'admin'
                }));
            }
            
            // Continue with the default link action
        });
    }
    
    // Format dates in a standard way
    document.querySelectorAll('.format-date').forEach(el => {
        const dateStr = el.getAttribute('data-date');
        if (dateStr) {
            try {
                const date = new Date(dateStr);
                el.textContent = new Intl.DateTimeFormat('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }).format(date);
            } catch (e) {
                console.error('Error formatting date:', e);
            }
        }
    });
});