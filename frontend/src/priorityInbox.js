/**
 * Priority Inbox - Notification Priority System
 * Fetches notifications from API and displays top 10 based on priority
 * Priority = Weight (placement > result > event) + Recency
 */

// Configuration
const API_URL = 'http://4.224.186.213/evaluation-service/notifications';
const PRIORITY_WEIGHTS = {
  placement: 3,   // Highest weight
  result: 2,      // Medium weight
  event: 1        // Lowest weight
};
const TOP_N = 10; // Display top 10 notifications
const MAX_CACHE_AGE = 5 * 60 * 1000; // 5 minutes in milliseconds

// State management
let notificationsCache = [];
let lastFetchTime = 0;

/**
 * Calculate priority score for a notification
 * Score = (type_weight * 100) + recency_score
 * Higher score = Higher priority
 */
function calculatePriority(notification) {
  const typeWeight = PRIORITY_WEIGHTS[notification.type] || PRIORITY_WEIGHTS.event;
  
  // Recency score: newer notifications get higher score (0-100)
  // Assuming notifications have a timestamp
  const notificationAge = Date.now() - new Date(notification.timestamp).getTime();
  const dayInMs = 24 * 60 * 60 * 1000;
  const recencyScore = Math.max(0, 100 - (notificationAge / dayInMs) * 10);
  
  // Combined priority
  const priority = (typeWeight * 100) + recencyScore;
  
  return {
    notification,
    priority,
    typeWeight,
    recencyScore
  };
}

/**
 * Fetch notifications from API
 */
async function fetchNotifications() {
  try {
    // Check cache first
    if (notificationsCache.length > 0 && Date.now() - lastFetchTime < MAX_CACHE_AGE) {
      console.log('Using cached notifications');
      return notificationsCache;
    }

    console.log('Fetching notifications from API...');
    const response = await fetch(API_URL);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Ensure we have an array
    notificationsCache = Array.isArray(data) ? data : data.notifications || [];
    lastFetchTime = Date.now();
    
    console.log(`Fetched ${notificationsCache.length} notifications`);
    return notificationsCache;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
}

/**
 * Get top N unread notifications by priority
 */
function getTopPriorityNotifications(notifications, n = TOP_N) {
  // Filter unread notifications
  const unreadNotifications = notifications.filter(notif => !notif.read);
  
  // Calculate priority for each
  const withPriority = unreadNotifications.map(calculatePriority);
  
  // Sort by priority (highest first)
  withPriority.sort((a, b) => b.priority - a.priority);
  
  // Return top N
  return withPriority.slice(0, n);
}

/**
 * Format notification for display
 */
function formatNotification(item) {
  const { notification, priority, typeWeight } = item;
  const timestamp = new Date(notification.timestamp);
  const timeStr = timestamp.toLocaleString();
  
  return {
    id: notification.id,
    title: notification.title || 'Untitled',
    description: notification.description || '',
    type: notification.type,
    typeWeight,
    priority: priority.toFixed(2),
    timestamp: timeStr,
    read: notification.read,
    icon: getIconForType(notification.type)
  };
}

/**
 * Get icon/emoji for notification type
 */
function getIconForType(type) {
  const icons = {
    placement: '📌',
    result: '✓',
    event: '📢'
  };
  return icons[type] || '📬';
}

/**
 * Display notifications in the DOM
 */
function displayNotifications(topNotifications) {
  const container = document.getElementById('priority-inbox-container');
  
  if (!container) {
    console.error('Container #priority-inbox-container not found');
    return;
  }

  // Clear existing content
  container.innerHTML = '';

  if (topNotifications.length === 0) {
    container.innerHTML = '<div class="no-notifications">No unread notifications</div>';
    return;
  }

  const html = topNotifications.map((item, index) => {
    const formatted = formatNotification(item);
    return `
      <div class="notification-item priority-${index + 1}">
        <div class="notification-header">
          <span class="icon">${formatted.icon}</span>
          <h3 class="title">${escapeHtml(formatted.title)}</h3>
          <span class="priority-badge">Priority: ${formatted.priority}</span>
        </div>
        <div class="notification-body">
          <p class="description">${escapeHtml(formatted.description)}</p>
          <div class="notification-meta">
            <span class="type-badge ${formatted.type}">${formatted.type}</span>
            <span class="timestamp">${formatted.timestamp}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Main function: Fetch and display priority notifications
 */
async function initPriorityInbox() {
  try {
    console.log('Initializing Priority Inbox...');
    
    // Fetch notifications
    const notifications = await fetchNotifications();
    
    if (notifications.length === 0) {
      console.warn('No notifications received');
      displayNotifications([]);
      return;
    }
    
    // Get top priority unread notifications
    const topNotifications = getTopPriorityNotifications(notifications, TOP_N);
    
    console.log(`Displaying top ${topNotifications.length} notifications`);
    
    // Display in UI
    displayNotifications(topNotifications);
    
  } catch (error) {
    console.error('Error initializing Priority Inbox:', error);
  }
}

/**
 * Refresh notifications (can be called manually or on interval)
 */
async function refreshNotifications() {
  notificationsCache = []; // Clear cache to force fresh fetch
  lastFetchTime = 0;
  await initPriorityInbox();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initPriorityInbox);

// Optional: Refresh every 2 minutes
setInterval(refreshNotifications, 2 * 60 * 1000);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initPriorityInbox,
    refreshNotifications,
    fetchNotifications,
    getTopPriorityNotifications,
    calculatePriority,
    displayNotifications
  };
}
