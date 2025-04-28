// admin/js/admin-auth-check.js
(function() {
    const adminToken = localStorage.getItem('adminToken');
    const adminUser  = JSON.parse(localStorage.getItem('adminUser') || '{}');
  
    if (!adminToken || adminUser.role !== 'admin') {
      return window.location.href = 'admin-login.html';
    }
  
    // display "Admin FirstName"
    const firstName = (adminUser.fullName||'').split(' ')[0];
    document.querySelectorAll('.admin-username')
      .forEach(el => el.textContent = `Admin ${firstName}`);
  
    // VERIFY against the microservice
    fetch('http://localhost:5001/admin/verify', {
      headers: { 'x-auth-token': adminToken }
    })
    .then(res => {
      if (!res.ok) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        window.location.href = 'admin-login.html';
      }
    })
    .catch(() => {
      // if the auth‐service is down, you may allow or force logout.
      console.warn('Could not reach auth service');
    });
  
    document.getElementById('admin-logout')?.addEventListener('click', () => {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      window.location.href = 'admin-login.html';
    });
  })();
  