/**
 * Auction creation functionality
 */
document.addEventListener('DOMContentLoaded', function() {
  // Prefill form if editing
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('edit') === '1') {
    const editListing = JSON.parse(localStorage.getItem('editListing') || '{}');
    if (editListing && editListing.id) {
      document.getElementById('item-title').value = editListing.title || '';
      document.getElementById('item-category').value = editListing.category || '';
      document.getElementById('item-condition').value = editListing.item_condition || '';
      document.getElementById('item-description').value = editListing.description || '';
      document.getElementById('starting-price').value = editListing.starting_price || '';
      document.getElementById('reserve-price').value = editListing.reserve_price || '';
      document.getElementById('auction-duration').value = editListing.duration || '';
      // Set images if you want (requires more logic)
      // Set shipping options if you want (requires more logic)
    }
    // Optionally clear editListing from localStorage after prefill
    // localStorage.removeItem('editListing');
  }

  // API URL
  const API_URL = 'http://localhost:5000/api/auctions';
  
  // Get token from local storage
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }
  
  // Cloudinary configuration
  const cloudName = 'dedsj6dac';  // Updated to match your actual cloud name
  const apiKey = '318486376371159';  // Add your API key
  const uploadPreset = 'bidmaster';
  
  // Store uploaded image URLs
  let uploadedImages = [];
  
  // Initialize Cloudinary widget with the correct configuration
  const myWidget = cloudinary.createUploadWidget(
    {
      cloudName: cloudName,
      apiKey: apiKey,       // Include API key
      uploadPreset: uploadPreset,
      folder: 'bidmaster',
      multiple: true,
      maxFiles: 10
    },
    (error, result) => {
      if (error) {
        console.error('Upload error details:', error);
      } else if (result && result.event === "success") {
        console.log('Upload success:', result.info.secure_url);
        
        uploadedImages.push({
          url: result.info.secure_url,
          publicId: result.info.public_id
        });
        
        displayUploadedImage(result.info.secure_url);
      }
    }
  );
  
  // Handle photo upload button click
  const photoUploadArea = document.querySelector('.photo-upload-area');
  if (photoUploadArea) {
    photoUploadArea.addEventListener('click', function() {
      myWidget.open();
    });
  }
  
  // Display uploaded image in the preview container
  function displayUploadedImage(imageUrl) {
    const photoPreviewContainer = document.querySelector('.photo-preview-container');
    
    // Create preview element
    const previewDiv = document.createElement('div');
    previewDiv.className = 'photo-preview';
    
    // Create image element
    const img = document.createElement('img');
    img.src = imageUrl;
    
    // Create remove button
    const removeButton = document.createElement('button');
    removeButton.className = 'remove-photo';
    removeButton.innerHTML = '&times;';
    removeButton.addEventListener('click', function(e) {
      e.stopPropagation(); // Prevent opening the widget
      
      // Find the image in our array
      const index = uploadedImages.findIndex(img => img.url === imageUrl);
      
      if (index !== -1) {
        // Remove from array
        uploadedImages.splice(index, 1);
        // Remove from DOM
        previewDiv.remove();
      }
    });
    
    // Add elements to container
    previewDiv.appendChild(img);
    previewDiv.appendChild(removeButton);
    photoPreviewContainer.appendChild(previewDiv);
  }
  
  // Handle form submission
  const createListingForm = document.querySelector('.create-listing-form');
  const createError = document.createElement('div');
  createError.className = 'error-message';
  createError.style.display = 'none';
  
  if (createListingForm) {
    // Add error message element to the form
    createListingForm.appendChild(createError);
    
    createListingForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      // Hide previous error
      createError.style.display = 'none';
      
      // Validate form
      if (!validateForm()) {
        return;
      }
      
      // Check if images were uploaded
      if (uploadedImages.length === 0) {
        createError.textContent = 'Please upload at least one image of your item';
        createError.style.display = 'block';
        return;
      }
      
      // Get form values
      const title = document.getElementById('item-title').value;
      const category = document.getElementById('item-category').value;
      const itemCondition = document.getElementById('item-condition').value;
      const description = document.getElementById('item-description').value;
      const startingPrice = parseFloat(document.getElementById('starting-price').value);
      const reservePrice = document.getElementById('reserve-price').value ? 
        parseFloat(document.getElementById('reserve-price').value) : null;
      const duration = document.getElementById('auction-duration').value;
      
      // Get shipping options
      const shippingCheckboxes = document.querySelectorAll('input[name="shipping"]:checked');
      const shippingOptions = Array.from(shippingCheckboxes).map(cb => cb.value);
      
      // Extract just the URLs for the API
      const imageUrls = uploadedImages.map(img => img.url);
      
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token
          },
          body: JSON.stringify({
            title,
            category,
            itemCondition,
            description,
            startingPrice,
            reservePrice,
            duration,
            shippingOptions,
            images: imageUrls
          })
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to create auction');
        }
        
        const data = await response.json();
        
        // Show success message
        showSuccessMessage('Auction created successfully! Your listing will be reviewed by our team before it becomes active. You can see its status in My Listings under scheduled.');
        
        // Reset form
        createListingForm.reset();
        uploadedImages = [];
        const photoPreviewContainer = document.querySelector('.photo-preview-container');
        if (photoPreviewContainer) {
          photoPreviewContainer.innerHTML = '';
        }
        
        // Scroll to the top of the page to show the success message
        window.scrollTo(0, 0);
        
      } catch (error) {
        console.error('Error creating auction:', error);
        createError.textContent = error.message || 'Error creating auction. Please try again.';
        createError.style.display = 'block';
      }
    });
  }
  
  /**
   * Validate form fields
   */
  function validateForm() {
    // Get form values
    const title = document.getElementById('item-title').value;
    const category = document.getElementById('item-category').value;
    const itemCondition = document.getElementById('item-condition').value;
    const description = document.getElementById('item-description').value;
    const startingPrice = document.getElementById('starting-price').value;
    const duration = document.getElementById('auction-duration').value;
    
    // Check required fields
    if (!title || !category || !itemCondition || !description || !startingPrice || !duration) {
      createError.textContent = 'Please fill in all required fields';
      createError.style.display = 'block';
      return false;
    }
    
    // Validate price
    if (isNaN(startingPrice) || parseFloat(startingPrice) <= 0) {
      createError.textContent = 'Starting price must be a positive number';
      createError.style.display = 'block';
      return false;
    }
    
    // Get shipping options
    const shippingCheckboxes = document.querySelectorAll('input[name="shipping"]:checked');
    if (shippingCheckboxes.length === 0) {
      createError.textContent = 'Please select at least one shipping option';
      createError.style.display = 'block';
      return false;
    }
    
    return true;
  }
  
  // Save as draft functionality
  const saveAsDraftButton = document.querySelector('.btn-secondary');
  if (saveAsDraftButton) {
    saveAsDraftButton.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Get form values (whatever is filled so far)
      const title = document.getElementById('item-title').value || 'Untitled Draft';
      const category = document.getElementById('item-category').value || '';
      const itemCondition = document.getElementById('item-condition').value || '';
      const description = document.getElementById('item-description').value || '';
      const startingPrice = document.getElementById('starting-price').value ? 
        parseFloat(document.getElementById('starting-price').value) : 0;
      
      // Save to localStorage (as backup)
      const draft = {
        id: Date.now(),
        title,
        category,
        itemCondition,
        description,
        startingPrice,
        images: uploadedImages.map(img => img.url),
        createdAt: new Date().toISOString()
      };
      
      // Get existing drafts
      const existingDrafts = JSON.parse(localStorage.getItem('auctionDrafts') || '[]');
      existingDrafts.push(draft);
      localStorage.setItem('auctionDrafts', JSON.stringify(existingDrafts));
      
      alert('Draft saved! You can find it in your drafts.');
    });
  }
});

/**
 * Display success message at the top of the form
 */
function showSuccessMessage(message) {
  // Remove any existing success message
  const existingMessage = document.querySelector('.success-message');
  if (existingMessage) {
    existingMessage.remove();
  }
  
  // Create success message element
  const successMessage = document.createElement('div');
  successMessage.className = 'success-message';
  
  // Add message text
  const messageText = document.createElement('p');
  messageText.textContent = message;
  successMessage.appendChild(messageText);
  
  // Add close button
  const closeButton = document.createElement('button');
  closeButton.className = 'close-btn';
  closeButton.innerHTML = '&times;';
  closeButton.setAttribute('aria-label', 'Close message');
  closeButton.addEventListener('click', function() {
    successMessage.remove();
  });
  successMessage.appendChild(closeButton);
  
  // Get the container and the heading
  const container = document.querySelector('.create-listing-container');
  const heading = container.querySelector('h1');
  
  // Insert success message after the heading
  heading.after(successMessage);
  
  // Optionally auto-hide message after some time
  /*
  setTimeout(() => {
    if (successMessage.parentNode) {
      successMessage.remove();
    }
  }, 10000); // Remove after 10 seconds
  */
}