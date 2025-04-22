/**
 * Profile page functionality
 */
document.addEventListener('DOMContentLoaded', function() {
  // API URL
  const API_URL = 'http://localhost:5000/api/auth';
  
  // Get token from local storage
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }
  
  // Initialize profile picture functionality
  if (typeof initProfilePicture === 'function') {
    initProfilePicture();
  } else {
    console.error('Profile picture function not available');
  }
  
  // Fetch user profile data
  fetchUserProfile();
  
  // Handle profile form submission
  const profileForm = document.querySelector('.profile-form');
  const successMessage = document.getElementById('profile-success');
  
  if (profileForm) {
    profileForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      // Get updated profile data from form
      const fullName = document.getElementById('full-name').value;
      const email = document.getElementById('email').value;
      const phone = document.getElementById('phone').value;
      
      // Get and format the aboutMe text
      let aboutMe = document.getElementById('bio').value;
      aboutMe = formatAboutMe(aboutMe);
      
      // Update the textarea with the formatted text immediately
      document.getElementById('bio').value = aboutMe;
      
      try {
        const response = await fetch(`${API_URL}/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token
          },
          body: JSON.stringify({
            fullName,
            email,
            phone,
            aboutMe
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to update profile');
        }
        
        const data = await response.json();

        // Preserve the role property from the old user object
        const oldUser = JSON.parse(localStorage.getItem('user') || '{}');
        const newUser = { ...oldUser, ...data.user };
        if (!newUser.role && oldUser.role) {
          newUser.role = oldUser.role;
        }
        localStorage.setItem('user', JSON.stringify(newUser));
        
        // Update username display in header
        updateUsernameDisplay();
        
        // Show success message with fade effect
        showSuccessMessage();
        
      } catch (error) {
        console.error('Error updating profile:', error);
        // Display error notification instead of alert
        showErrorMessage('Failed to update profile. Please try again later.');
      }
    });
  }
  
  // Handle security form submission
  const passwordForm = document.querySelector('.password-form');
  const passwordError = document.getElementById('password-error');
  const passwordSuccess = document.getElementById('password-success');

  if (passwordForm) {
    passwordForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      // Hide any existing messages
      hideMessage(passwordError);
      hideMessage(passwordSuccess);
      
      // Get form values
      const currentPassword = document.getElementById('current-password').value;
      const newPassword = document.getElementById('new-password').value;
      const confirmPassword = document.getElementById('confirm-new-password').value;
      
      // Password validation
      if (newPassword.length < 8) {
        showMessage(passwordError, 'New password must be at least 8 characters');
        return;
      }
      
      if (newPassword !== confirmPassword) {
        showMessage(passwordError, 'New passwords do not match');
        return;
      }
      
      try {
        const response = await fetch(`${API_URL}/change-password`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token
          },
          body: JSON.stringify({
            currentPassword,
            newPassword
          })
        });
        
        const data = await response.json();
        
        if (response.status === 400) {
          // This is an expected validation error, handle it gracefully
          console.log('Password validation error:', data.message);
          showMessage(passwordError, data.message || 'Failed to update password');
          return;
        } else if (!response.ok) {
          // This is an unexpected server error
          console.error('Server error during password change:', data.message);
          showMessage(passwordError, data.message || 'Failed to update password');
          return;
        }
        
        // Clear the form
        passwordForm.reset();
        
        // Show success message
        showMessage(passwordSuccess, 'Password updated successfully!');
        
      } catch (error) {
        console.error('Connection error updating password:', error);
        showMessage(passwordError, 'Connection error. Please try again later.');
      }
    });
  }
  
  /**
   * Format the About Me text
   * - Capitalize first letter
   * - Add period at end if missing
   */
  function formatAboutMe(text) {
    if (!text) return '';
    
    // Capitalize first letter
    let formatted = text.charAt(0).toUpperCase() + text.slice(1);
    
    // Add period at end if missing
    const lastChar = formatted.trim().slice(-1);
    if (!['.', '!', '?'].includes(lastChar) && formatted.trim().length > 0) {
      formatted = formatted.trim() + '.';
    }
    
    return formatted;
  }
  
  /**
   * Show success message with fade effect
   */
  function showSuccessMessage() {
    showMessage(successMessage, 'Profile updated successfully!');
  }
  
  /**
   * Show error message (could be implemented similar to success message)
   */
  function showErrorMessage(message) {
    // Replace the alert with our new function
    const errorEl = document.createElement('div');
    errorEl.className = 'error-message';
    errorEl.textContent = message;
    
    // Insert after the form actions
    const formActions = document.querySelector('.form-actions');
    formActions.parentNode.insertBefore(errorEl, formActions.nextSibling);
    
    showMessage(errorEl, message);
    
    // Remove after delay
    setTimeout(() => {
      errorEl.remove();
    }, 5000);
  }
  
  /**
   * Fetch user profile data from server
   */
  async function fetchUserProfile() {
    try {
      const response = await fetch(`${API_URL}/profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }
      
      const data = await response.json();
      updateProfileUI(data.user);
      
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  }
  
  /**
   * Update profile UI with user data
   */
  function updateProfileUI(user) {
    // Update form fields
    document.getElementById('full-name').value = user.fullName || '';
    document.getElementById('email').value = user.email || '';
    document.getElementById('phone').value = user.phone || '';
    document.getElementById('bio').value = user.aboutMe || '';
    
    // Format and update the member-since date
    const memberSinceElement = document.querySelector('.member-since p');
    if (memberSinceElement) {
      if (user.createdAt) {
        try {
          // Try both with and without parsing
          let formattedDate;
          try {
            const createdDate = new Date(user.createdAt);
            formattedDate = new Intl.DateTimeFormat('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }).format(createdDate);
          } catch (e) {
            // If parsing fails, display the raw date
            formattedDate = user.createdAt.toString();
          }
          
          memberSinceElement.textContent = `Member since: ${formattedDate}`;
        } catch (error) {
          console.error('Error with date:', error, user.createdAt);
          memberSinceElement.textContent = `Member since: ${String(user.createdAt)}`;
        }
      } else {
        console.log('No createdAt in user data. Full user:', user);
        memberSinceElement.textContent = 'Member since: (Not available)';
      }
    }
    
    // Update sidebar username
    updateUsernameDisplay();
    
    // Store the updated user data in localStorage, preserving role
    const oldUser = JSON.parse(localStorage.getItem('user') || '{}');
    const newUser = { ...oldUser, ...user };
    if (!newUser.role && oldUser.role) {
      newUser.role = oldUser.role;
    }
    localStorage.setItem('user', JSON.stringify(newUser));

    // Re-initialize profile picture UI with latest data
    if (typeof initProfilePicture === 'function') {
      initProfilePicture();
    }
  }
  
  /**
   * Update username display in header
   */
  function updateUsernameDisplay() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const usernameElements = document.querySelectorAll('.username');
    
    if (user && user.fullName) {
      const firstName = user.fullName.split(' ')[0];
      usernameElements.forEach(el => {
        el.textContent = `Welcome, ${firstName}`;
      });
    }
  }
  
  /**
   * Show message element with fade effect
   */
  function showMessage(element, message) {
    if (element) {
      element.textContent = message;
      element.classList.add('show');
      
      // Add fade-out for success messages
      if (element.id.includes('success')) {
        setTimeout(() => {
          element.classList.add('fade-out');
          
          setTimeout(() => {
            element.classList.remove('show');
            element.classList.remove('fade-out');
          }, 300);
          
        }, 3000);
      }
    }
  }
  
  /**
   * Hide message element
   */
  function hideMessage(element) {
    if (element) {
      element.classList.remove('show');
    }
  }

  // After fetching user profile data, fetch stats
  fetchProfileStats();

  async function fetchProfileStats() {
    const token = localStorage.getItem('token');
    if (!token) return;

    const statItems = document.querySelectorAll('.profile-stats .stat-value');
    if (statItems.length < 3) return;

    try {
      // Fetch bid counts
      const bidsRes = await fetch('http://localhost:5000/api/bids/counts', {
        headers: { 'x-auth-token': token }
      });
      const bidsData = await bidsRes.json();

      // Fetch active listings count
      const activeListingsRes = await fetch('http://localhost:5000/api/auctions/my-active-listings-count', {
        headers: { 'x-auth-token': token }
      });
      const activeListingsData = await activeListingsRes.json();

      // Set Active Bids
      statItems[0].textContent = bidsData.activeBids || 0;
      // Set Won Auctions
      statItems[1].textContent = bidsData.wonAuctions || 0;
      // Set Active Listings (from backend)
      statItems[2].textContent = activeListingsData.activeListings || 0;

    } catch (error) {
      console.error('Error fetching profile stats:', error);
      statItems[0].textContent = '0';
      statItems[1].textContent = '0';
      statItems[2].textContent = '0';
    }
  }
});