/**
 * Handle login and registration API calls
 */
document.addEventListener('DOMContentLoaded', function() {
  // API URL
  const API_URL = 'http://localhost:5000/api/auth';
  
  // Check if already authenticated
  const token = localStorage.getItem('token');
  if (token && window.location.pathname.includes('login.html')) {
    window.location.href = 'index.html';
    return;
  }
  
  // Login form
  const loginForm = document.querySelector('#login-form form');
  const loginError = document.getElementById('login-error');
  
  if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      // Hide previous errors
      loginError.style.display = 'none';
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      try {
        const response = await fetch(`${API_URL}/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
          // Save token to localStorage
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          
          // Redirect to homepage
          window.location.href = 'index.html';
        } else {
          // Show error message
          loginError.textContent = data.message || 'Invalid email or password';
          loginError.style.display = 'block';
        }
      } catch (error) {
        console.error('Login error:', error);
        loginError.textContent = 'Connection error. Please try again later.';
        loginError.style.display = 'block';
      }
    });
  }
  
  // Registration form
  const registerForm = document.querySelector('#register-form form');
  const registerError = document.getElementById('register-error');
  
  if (registerForm) {
    registerForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      // Hide previous errors
      registerError.style.display = 'none';
      
      const fullName = document.getElementById('full-name').value;
      const email = document.getElementById('reg-email').value;
      const phone = document.getElementById('phone').value;
      const password = document.getElementById('reg-password').value;
      const confirmPassword = document.getElementById('confirm-password').value;
      
      // Basic validation
      if (password !== confirmPassword) {
        registerError.textContent = 'Passwords do not match';
        registerError.style.display = 'block';
        return;
      }
      
      if (password.length < 8) {
        registerError.textContent = 'Password must be at least 8 characters';
        registerError.style.display = 'block';
        return;
      }
      
      try {
        const response = await fetch(`${API_URL}/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fullName, email, phone, password }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
          // Save token to localStorage
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          
          // Redirect to homepage
          window.location.href = 'index.html';
        } else {
          // Show error message
          registerError.textContent = data.message || 'Registration failed';
          registerError.style.display = 'block';
        }
      } catch (error) {
        console.error('Registration error:', error);
        registerError.textContent = 'Connection error. Please try again later.';
        registerError.style.display = 'block';
      }
    });
  }
});

/**
 * Tab switching for login/register
 */
function switchTab(tabId) {
  // Hide all forms
  document.querySelectorAll('.auth-form').forEach(form => {
      form.classList.add('hidden');
  });
  
  // Show the selected form
  document.getElementById(tabId + '-form').classList.remove('hidden');
  
  // Update tab buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
  });
  
  // Add active class to clicked tab
  document.querySelector(`.tab-button[onclick="switchTab('${tabId}')"]`).classList.add('active');
}