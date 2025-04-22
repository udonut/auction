/**
 * User account functionality including profile picture management
 */

// Update these Cloudinary configuration values
// You need to replace these with your actual Cloudinary credentials
const CLOUDINARY_CLOUD_NAME = 'dedsj6dac'; 
const CLOUDINARY_UPLOAD_PRESET = 'bidmaster';
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

/**
 * Initialize profile picture upload functionality
 */
function initProfilePicture() {
    const profileImageBtn = document.querySelector('.profile-image-edit');
    const profileImage = document.querySelector('.profile-image');
    const removeBtn = document.getElementById('remove-photo-btn');

    // Create file input if it doesn't exist
    let fileInput = document.getElementById('profile-image-upload');
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'profile-image-upload';
        fileInput.accept = '.jpg,.jpeg,.png,.webp,.gif';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
    }
    
    // Create progress container if it doesn't exist
    let progressContainer = document.querySelector('.upload-progress');
    if (!progressContainer) {
        progressContainer = document.createElement('div');
        progressContainer.className = 'upload-progress';
        progressContainer.style.display = 'none';
        progressContainer.innerHTML = '<div class="progress-bar"></div>';
        
        // Insert after the Change Photo button
        if (profileImageBtn) {
            profileImageBtn.parentNode.insertBefore(progressContainer, profileImageBtn.nextSibling);
        }
    }
    
    // Progress bar element
    const progressBar = progressContainer.querySelector('.progress-bar');
    
    // Load current profile image
    loadProfileImage();
    
    // Handle click on Change Photo button
    if (profileImageBtn && fileInput) {
        profileImageBtn.addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', async (event) => {
            if (event.target.files.length > 0) {
                const file = event.target.files[0];
                
                // Create an error message container if it doesn't exist
                let errorContainer = document.querySelector('.profile-image-error');
                if (!errorContainer) {
                    errorContainer = document.createElement('div');
                    errorContainer.className = 'profile-image-error';
                    errorContainer.style.color = '#d90429';
                    errorContainer.style.fontSize = '0.9rem';
                    errorContainer.style.marginTop = '0.5rem';
                    errorContainer.style.textAlign = 'center';
                    profileImageBtn.parentNode.insertBefore(errorContainer, progressContainer);
                }
                
                // Clear previous error message
                errorContainer.textContent = '';
                errorContainer.style.display = 'none';
                
                // Validate file type
                const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image.webp', 'image/gif'];
                if (!validTypes.includes(file.type)) {
                    errorContainer.textContent = 'Please select an image file (JPG, JPEG, PNG, WEBP, or GIF).';
                    errorContainer.style.display = 'block';
                    return;
                }
                
                // Validate file size (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    errorContainer.textContent = 'File size must be less than 5MB.';
                    errorContainer.style.display = 'block';
                    return;
                }
                
                // Update the uploadToCloudinary part in the fileInput event listener
                try {
                    // Show progress bar
                    progressContainer.style.display = 'block';
                    profileImageBtn.disabled = true;
                    profileImageBtn.textContent = 'Uploading...';
                    
                    // Upload to Cloudinary
                    const imageUrl = await uploadToCloudinary(file, updateProgress);
                    
                    // Save to database and local storage
                    await updateProfilePictureInDB(imageUrl);
                    
                    // Update profile image immediately in the DOM
                    loadProfileImage();
                    
                    // Update button state
                    progressContainer.style.display = 'none';
                    profileImageBtn.disabled = false;
                    profileImageBtn.textContent = 'Change Photo';
                    
                    // Show success message
                    showInlineMessage('Profile picture updated successfully!', 'success', profileImageBtn);
                    
                } catch (error) {
                    console.error('Error uploading profile image:', error);
                    // Reset button state
                    progressContainer.style.display = 'none';
                    profileImageBtn.disabled = false;
                    profileImageBtn.textContent = 'Change Photo';
                    
                    // Show error message
                    showInlineMessage('Failed to upload image. Please try again.', 'error', profileImageBtn);
                }
            }
        });
    }
    
    // Remove photo button logic
    if (removeBtn) {
        removeBtn.addEventListener('click', async function() {
            const token = localStorage.getItem('token');
            if (!token) return;
            removeBtn.disabled = true;
            removeBtn.textContent = 'Removing...';

            try {
                // Call backend to remove photo
                const response = await fetch('http://localhost:5000/api/auth/profile-picture', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-auth-token': token
                    },
                    body: JSON.stringify({ profileImage: '' })
                });

                // Remove from localStorage and UI
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                delete user.profileImage;
                localStorage.setItem('user', JSON.stringify(user));
                loadProfileImage();

                if (response.ok) {
                    showInlineMessage('Profile photo removed.', 'success', removeBtn);
                } else {
                    showInlineMessage('Failed to remove photo from server, but removed locally.', 'error', removeBtn);
                }
            } catch (err) {
                showInlineMessage('Failed to remove photo. Please try again.', 'error', removeBtn);
            } finally {
                removeBtn.disabled = false;
                removeBtn.textContent = 'Remove Photo';
            }
        });
    }

    // Helper to show inline message below the Change Photo button
    function showInlineMessage(message, type, referenceBtn) {
        let msg = document.querySelector('.profile-image-message');
        if (!msg) {
            msg = document.createElement('div');
            msg.className = 'profile-image-message';
            referenceBtn.parentNode.insertBefore(msg, referenceBtn.nextSibling);
        }
        msg.textContent = message;
        msg.style.color = type === 'success' ? '#38b000' : '#d90429';
        msg.style.background = type === 'success'
            ? 'rgba(56, 176, 0, 0.08)'
            : 'rgba(217, 4, 41, 0.08)';
        msg.style.borderLeft = `3px solid ${type === 'success' ? '#38b000' : '#d90429'}`;
        msg.style.padding = '0.5rem 1rem';
        msg.style.margin = '0.5rem 0 1rem 0';
        msg.style.fontSize = '0.95rem';
        msg.style.borderRadius = '4px';
        msg.style.display = 'block';
        // Auto-hide after 3 seconds
        setTimeout(() => {
            msg.style.display = 'none';
        }, 3000);
    }
    
    /**
     * Update progress bar during upload
     */
    function updateProgress(progress) {
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
    }
    
    /**
     * Load profile image from user data
     */
    function loadProfileImage() {
        const profileImageDiv = document.getElementById('profile-image');
        const removeBtn = document.getElementById('remove-photo-btn');
        if (!profileImageDiv) return;
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        profileImageDiv.innerHTML = ''; // Clear previous content
    
        if (user.profileImage) {
            // Show uploaded image
            const img = document.createElement('img');
            img.src = user.profileImage;
            img.alt = user.fullName || user.name || 'Profile';
            img.onerror = function() {
                profileImageDiv.innerHTML = getInitialsHTML(user.fullName || user.name || '');
            };
            profileImageDiv.appendChild(img);
    
            // Show remove button
            if (removeBtn) removeBtn.style.display = 'block';
        } else {
            // Show initials
            profileImageDiv.innerHTML = getInitialsHTML(user.fullName || user.name || '');
            // Hide remove button
            if (removeBtn) removeBtn.style.display = 'none';
        }
    }
    
    // Helper to get initials HTML
    function getInitialsHTML(name) {
        const initials = getInitials(name);
        return `<span>${initials}</span>`;
    }

    // Helper to get initials from name
    function getInitials(name) {
        if (!name) return '';
        const parts = name.trim().split(' ');
        if (parts.length === 1) return parts[0][0] || '';
        return (parts[0][0] + (parts[1][0] || '')).toUpperCase();
    }
}

/**
 * Upload image to Cloudinary
 * @param {File} file - The image file to upload
 * @param {Function} progressCallback - Function to call with upload progress
 * @returns {Promise<string>} - URL of the uploaded image
 */
async function uploadToCloudinary(file, progressCallback) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        
        const xhr = new XMLHttpRequest();
        
        // Setup progress monitoring
        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
                const progress = Math.round((event.loaded / event.total) * 100);
                if (progressCallback) {
                    progressCallback(progress);
                }
            }
        });
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    resolve(response.secure_url);
                } else {
                    console.error('Cloudinary error:', xhr.responseText);
                    reject(new Error('Upload failed'));
                }
            }
        };
        
        xhr.open('POST', CLOUDINARY_URL, true);
        xhr.send(formData);
    });
}

/**
 * Update profile picture in database
 * @param {string} imageUrl - The URL of the uploaded image
 */
async function updateProfilePictureInDB(imageUrl) {
    const token = localStorage.getItem('token');
    if (!token) {
        console.warn('No authentication token found, updating local storage only');
        // Always update the local storage
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.profileImage = imageUrl;
        localStorage.setItem('user', JSON.stringify(user));
        return { success: true, localOnly: true };
    }
    
    try {
        // Always update the local storage first for instant feedback
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.profileImage = imageUrl;
        localStorage.setItem('user', JSON.stringify(user));
        
        // Then try to update the database in the background
        const response = await fetch('http://localhost:5000/api/auth/profile-picture', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify({ profileImage: imageUrl })
        });
        
        // Even if this fails, the user won't notice because we've already updated locally
        if (!response.ok) {
            const responseText = await response.text();
            console.log('Server response:', responseText);
            console.warn('Failed to update profile picture in database, but local storage is updated');
            return { success: true, localOnly: true };
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error saving profile picture to database:', error);
        return { success: true, localOnly: true };
    }
}

// Export functions to be used in other scripts
window.initProfilePicture = initProfilePicture;