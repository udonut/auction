document.addEventListener('DOMContentLoaded', function() {
  loadCategoryCounts();

  /**
   * Load and display the count of active listings for each category
   */
  async function loadCategoryCounts() {
    try {
      // Show loading state
      document.querySelectorAll('.category-stats span').forEach(el => {
        el.textContent = 'Loading counts...';
      });

      const response = await fetch('http://localhost:5000/api/auctions/category-counts');
      if (!response.ok) {
        throw new Error('Failed to load category counts');
      }
      
      const categoryCounts = await response.json();
      
      // Update each category stat with the real count
      document.querySelectorAll('.category-card').forEach(card => {
        const categoryName = card.querySelector('h2').textContent.toLowerCase();
        const countSpan = card.querySelector('.category-stats span');
        
        if (countSpan) {
          // Get count for this category, default to 0 if not found
          const count = categoryCounts[categoryName] || 0;
          countSpan.textContent = `${count} active ${count === 1 ? 'listing' : 'listings'}`;
        }
      });
      
    } catch (error) {
      console.error('Error loading category counts:', error);
      document.querySelectorAll('.category-stats span').forEach(el => {
        el.textContent = 'Count unavailable';
      });
    }
  }
});