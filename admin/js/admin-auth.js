// admin/js/admin-auth.js
document.addEventListener('DOMContentLoaded', () => {
    const form     = document.querySelector('.admin-login-form');
    const loginErr = document.getElementById('admin-login-error');
  
    form.addEventListener('submit', e => {
      e.preventDefault();
      loginErr.style.display = 'none';
  
      const email    = document.getElementById('admin-email').value;
      const password = document.getElementById('admin-password').value;
  
      // POINT AT YOUR AUTH SERVICE ON 5001
      fetch('http://localhost:5001/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      .then(res => res.json())
      .then(data => {
        if (data.token) {
          localStorage.setItem('adminToken', data.token);
          localStorage.setItem('adminUser', JSON.stringify({
            email:    data.user.email,
            fullName: data.user.fullName,
            name:     data.user.fullName,
            role:     data.user.role
          }));
          window.location.href = 'admin-dashboard.html';
        } else {
          loginErr.textContent = data.message || 'Invalid admin credentials';
          loginErr.style.display = 'block';
        }
      })
      .catch(() => {
        loginErr.textContent = 'Connection error. Please try again.';
        loginErr.style.display = 'block';
      });
    });
  });
  