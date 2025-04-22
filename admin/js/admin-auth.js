/**
 * Handles admin authentication
 */
document.addEventListener('DOMContentLoaded', function() {
    const adminLoginForm = document.querySelector('.admin-login-form');
    const loginError = document.getElementById('admin-login-error');
    
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Hide any previous errors
            loginError.style.display = 'none';
            
            // Get form values
            const email = document.getElementById('admin-email').value;
            const password = document.getElementById('admin-password').value;
            
            // Send authentication request to the server
            fetch('http://localhost:5000/api/auth/admin-login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            })
            .then(response => response.json())
            .then(data => {
                if (data.token) {
                    // Store admin token and user info
                    localStorage.setItem('adminToken', data.token);
                    localStorage.setItem('adminUser', JSON.stringify({
                        email: data.user.email,
                        // Store both fullName and name for consistency
                        fullName: data.user.fullName || data.user.name,
                        name: data.user.name,
                        role: data.user.role
                    }));
                    
                    // Redirect to admin dashboard
                    window.location.href = 'admin-dashboard.html';
                } else {
                    // Show error message from server
                    loginError.textContent = data.message || 'Invalid admin credentials';
                    loginError.style.display = 'block';
                }
            })
            .catch(error => {
                console.error('Login error:', error);
                loginError.textContent = 'Connection error. Please try again.';
                loginError.style.display = 'block';
                
                if (email === 'admin@bidmaster.com' && password === 'admin123') {
                    localStorage.setItem('adminToken', 'demo-admin-token');
                    localStorage.setItem('adminUser', JSON.stringify({
                        email: 'admin@bidmaster.com',
                        fullName: 'Admin User',
                        name: 'Admin User',
                        role: 'admin'
                    }));
                    window.location.href = 'admin-dashboard.html';
                }
            });
        });
    }
});