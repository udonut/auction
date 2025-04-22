document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the dashboard page
    if (!document.querySelector('.admin-stats-grid')) return;
    
    // Get admin token from localStorage
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
        window.location.href = 'admin-login.html';
        return;
    }
    
    // Fetch dashboard statistics
    fetchDashboardStats();
    
    // Fetch recent activities
    fetchRecentActivities();
    
    function fetchDashboardStats() {
        fetch('http://localhost:5000/api/auctions/admin/dashboard-stats', {
            headers: {
                'x-auth-token': adminToken
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load dashboard data');
            }
            return response.json();
        })
        .then(data => {
            updateDashboardStats(data);
        })
        .catch(error => {
            console.error('Error fetching dashboard stats:', error);
            showError('Error loading dashboard statistics');
        });
    }
    
    function fetchRecentActivities() {
        fetch('http://localhost:5000/api/auctions/admin/recent-activities', {
            headers: {
                'x-auth-token': adminToken
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load activity data');
            }
            return response.json();
        })
        .then(activities => {
            updateRecentActivities(activities);
        })
        .catch(error => {
            console.error('Error fetching recent activities:', error);
            showActivityError('Error loading recent activity');
        });
    }
    
    function updateDashboardStats(stats) {
        // Update pending verification stats
        const pendingCard = document.querySelector('.admin-stat-card:nth-child(1)');
        const pendingValue = pendingCard.querySelector('.stat-value');
        const pendingChange = pendingCard.querySelector('.stat-change');
        
        pendingValue.textContent = stats.pendingVerification.total;
        
        if (stats.pendingVerification.change > 0) {
            pendingChange.textContent = `+${stats.pendingVerification.change} ${stats.pendingVerification.changeLabel}`;
            pendingChange.className = 'stat-change positive';
        } else if (stats.pendingVerification.change < 0) {
            pendingChange.textContent = `${stats.pendingVerification.change} ${stats.pendingVerification.changeLabel}`;
            pendingChange.className = 'stat-change negative';
        } else {
            pendingChange.textContent = `No change ${stats.pendingVerification.changeLabel}`;
            pendingChange.className = 'stat-change neutral';
        }
        
        // Update active auctions stats
        const activeCard = document.querySelector('.admin-stat-card:nth-child(2)');
        const activeValue = activeCard.querySelector('.stat-value');
        const activeChange = activeCard.querySelector('.stat-change');
        
        activeValue.textContent = stats.activeAuctions.total;
        
        if (stats.activeAuctions.change > 0) {
            activeChange.textContent = `+${stats.activeAuctions.change} ${stats.activeAuctions.changeLabel}`;
            activeChange.className = 'stat-change positive';
        } else if (stats.activeAuctions.change < 0) {
            activeChange.textContent = `${stats.activeAuctions.change} ${stats.activeAuctions.changeLabel}`;
            activeChange.className = 'stat-change negative';
        } else {
            activeChange.textContent = `No change ${stats.activeAuctions.changeLabel}`;
            activeChange.className = 'stat-change neutral';
        }
    }
    
    function updateRecentActivities(activities) {
        const activityList = document.querySelector('.activity-list');
        
        // Clear existing activities
        activityList.innerHTML = '';
        
        if (activities.length === 0) {
            activityList.innerHTML = '<li class="empty-message">No recent activity</li>';
            return;
        }
        
        // Add each activity to the list
        activities.forEach(activity => {
            const li = document.createElement('li');
            
            // Format the time
            const timeStr = formatTimeAgo(new Date(activity.time));
            
            // Determine status class for admin name styling
            let statusClass = '';
            if (activity.status === 'active') statusClass = 'approved';
            else if (activity.status === 'rejected') statusClass = 'rejected';
            else if (activity.status === 'more_info') statusClass = 'more-info';
            else if (activity.status === 'login') {
                // Keep login status as-is (gray by default)
                statusClass = '';
            }
            
            // Update the HTML structure to include the item name with ellipsis
            li.innerHTML = `
                <span class="activity-time">${timeStr}</span>
                <span class="activity-action">${activity.action}</span>
                <span class="activity-details">
                    <span class="activity-item-name" title="${activity.details}">${activity.details}</span>
                    ${activity.adminName ? `<span class="admin-name ${statusClass}">${activity.adminName}</span>` : ''}
                </span>
            `;
            
            activityList.appendChild(li);
        });
    }
    
    function formatTimeAgo(date) {
        const now = new Date();
        const diffInHours = (now - date) / (1000 * 60 * 60);
        
        if (diffInHours < 24) {
            if (diffInHours < 1) {
                const minutes = Math.floor((now - date) / (1000 * 60));
                return minutes <= 1 ? 'Just now' : `${minutes} mins ago`;
            }
            return `${Math.floor(diffInHours)} hours ago`;
        } else if (diffInHours < 48) {
            return 'Yesterday';
        } else if (diffInHours < 168) { // 7 days
            return `${Math.floor(diffInHours / 24)} days ago`;
        } else {
            return new Date(date).toLocaleDateString();
        }
    }
    
    function showError(message) {
        const statsGrid = document.querySelector('.admin-stats-grid');
        statsGrid.innerHTML = `<div class="error-message">${message}</div>`;
    }
    
    function showActivityError(message) {
        const activityList = document.querySelector('.activity-list');
        activityList.innerHTML = `<li class="error-message">${message}</li>`;
    }
});