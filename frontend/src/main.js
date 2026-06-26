// Afford Notification Platform - Frontend Controller

const API_BASE = "http://localhost:5000/api";

// App State
let state = {
  token: localStorage.getItem("token") || null,
  user: JSON.parse(localStorage.getItem("user")) || null,
  notifications: [],
  currentPage: 1,
  totalPages: 1,
  currentFilter: "all", // all, read, unread
  eventSource: null, // SSE instance
};

// DOM Elements
const authScreen = document.getElementById("auth-screen");
const dashboardScreen = document.getElementById("dashboard-screen");
const userStatusArea = document.getElementById("user-status-area");
const customAuthForm = document.getElementById("custom-auth-form");
const customUsernameInput = document.getElementById("custom-username");
const simulatorForm = document.getElementById("simulator-form");
const simTargetSelect = document.getElementById("sim-target");
const simTitleInput = document.getElementById("sim-title");
const simMessageInput = document.getElementById("sim-message");
const connStatusBadge = document.getElementById("conn-status");
const notificationsList = document.getElementById("notifications-list");
const markAllReadBtn = document.getElementById("mark-all-read-btn");
const toastContainer = document.getElementById("toast-container");
const prevPageBtn = document.getElementById("prev-page-btn");
const nextPageBtn = document.getElementById("next-page-btn");
const pageIndicator = document.getElementById("page-indicator");
const paginationControls = document.getElementById("pagination-controls");

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  checkAuth();
});

// Setup Event Listeners
function setupEventListeners() {
  // Login Profile buttons
  document.querySelectorAll(".user-profile-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const username = btn.dataset.username;
      login(username);
    });
  });

  // Custom login submit
  customAuthForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = customUsernameInput.value.trim();
    if (username) login(username);
  });

  // Filter Buttons
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      state.currentFilter = e.target.dataset.filter;
      state.currentPage = 1;
      fetchNotifications();
    });
  });

  // Mark all read button
  markAllReadBtn.addEventListener("click", markAllRead);

  // Pagination buttons
  prevPageBtn.addEventListener("click", () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      fetchNotifications();
    }
  });

  nextPageBtn.addEventListener("click", () => {
    if (state.currentPage < state.totalPages) {
      state.currentPage++;
      fetchNotifications();
    }
  });

  // Simulator submit
  simulatorForm.addEventListener("submit", handleSimulateNotification);

  // Auto-select type-badge styling inside grid
  document.querySelectorAll("input[name='sim-type']").forEach((radio) => {
    radio.addEventListener("change", (e) => {
      document.querySelectorAll(".type-label").forEach((lbl) => lbl.classList.remove("checked"));
      e.target.closest(".type-label").classList.add("checked");
    });
  });
}

// Authentication check
function checkAuth() {
  if (state.token && state.user) {
    showDashboard();
  } else {
    showLogin();
  }
}

// Login API handler
async function login(username) {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });

    const data = await res.json();
    if (data.success) {
      state.token = data.token;
      state.user = data.user;

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      showDashboard();
      showToast("success", "Logged In Successfully", `Welcome back, ${data.user.username}!`);
    } else {
      showToast("error", "Login Failed", data.message || "Failed to log in.");
    }
  } catch (error) {
    console.error("Login error:", error);
    showToast("error", "Connection Error", "Cannot reach authentication server.");
  }
}

// Logout handler
function logout() {
  // Disconnect SSE stream
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }

  state.token = null;
  state.user = null;
  state.notifications = [];
  localStorage.removeItem("token");
  localStorage.removeItem("user");

  showLogin();
  showToast("info", "Logged Out", "You have been logged out of the session.");
}

// UI transitions
function showLogin() {
  authScreen.classList.remove("hidden");
  dashboardScreen.classList.add("hidden");
  userStatusArea.innerHTML = "";
}

function showDashboard() {
  authScreen.classList.add("hidden");
  dashboardScreen.classList.remove("hidden");

  // Render profile status
  userStatusArea.innerHTML = `
    <div class="user-profile-badge">
      <span class="avatar-mini">${state.user.username === "alice" ? "👩‍💻" : state.user.username === "bob" ? "👨‍💻" : "👤"}</span>
      <span class="name">${state.user.username}</span>
    </div>
    <button id="logout-btn" class="logout-btn">Sign Out</button>
  `;

  document.getElementById("logout-btn").addEventListener("click", logout);

  // Setup options in simulator target
  populateSimulatorTargets();

  // Reset pagination & list
  state.currentPage = 1;
  state.currentFilter = "all";
  document.querySelectorAll(".filter-btn").forEach((b) => {
    b.classList.remove("active");
    if (b.dataset.filter === "all") b.classList.add("active");
  });

  fetchNotifications();
  setupRealtimeStream();
}

// Populate target users select dropdown
function populateSimulatorTargets() {
  simTargetSelect.innerHTML = "";

  const users = [
    { id: "user_alice_123", name: "Alice (user_alice_123)" },
    { id: "user_bob_123", name: "Bob (user_bob_123)" },
  ];

  // If custom user is logged in, add them too
  if (state.user.id !== "user_alice_123" && state.user.id !== "user_bob_123") {
    users.push({ id: state.user.id, name: `${state.user.username} (You)` });
  }

  users.forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = u.name;
    // Default select current user
    if (u.id === state.user.id) {
      opt.selected = true;
    }
    simTargetSelect.appendChild(opt);
  });
}

// Fetch Notifications List
async function fetchNotifications() {
  try {
    const res = await fetch(
      `${API_BASE}/notifications?status=${state.currentFilter}&page=${state.currentPage}&limit=5`,
      {
        headers: {
          Authorization: `Bearer ${state.token}`,
        },
      }
    );

    const data = await res.json();
    if (data.success) {
      state.notifications = data.data;
      state.totalPages = data.pagination.totalPages;
      renderNotificationsList();
      renderPagination(data.pagination);
    } else {
      showToast("error", "Error", data.message || "Failed to load notifications.");
    }
  } catch (error) {
    console.error("Fetch error:", error);
    showToast("error", "Network Error", "Could not retrieve notifications from database.");
  }
}

// Render notification DOM elements
function renderNotificationsList() {
  if (state.notifications.length === 0) {
    notificationsList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📭</span>
        <p>No ${state.currentFilter !== "all" ? state.currentFilter : ""} notifications found.</p>
      </div>
    `;
    return;
  }

  notificationsList.innerHTML = "";
  state.notifications.forEach((notif) => {
    const item = document.createElement("div");
    item.className = `notification-item ${notif.isRead ? "read" : "unread"}`;
    item.id = `notif-${notif.id}`;

    const typeIcons = {
      info: "ℹ️",
      success: "✅",
      warning: "⚠️",
      error: "🚨",
    };

    const icon = typeIcons[notif.type] || "🔔";
    const dateStr = new Date(notif.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    item.innerHTML = `
      <div class="notification-item-icon">${icon}</div>
      <div class="notification-item-content">
        <div class="notification-item-title">${escapeHTML(notif.title)}</div>
        <div class="notification-item-message">${escapeHTML(notif.message)}</div>
        <div class="notification-item-meta">
          <span class="notification-item-time">${dateStr}</span>
          ${
            !notif.isRead
              ? `<button class="mark-read-item-btn" data-id="${notif.id}">Mark Read</button>`
              : ""
          }
        </div>
      </div>
    `;

    // Event listener for mark single read
    const btn = item.querySelector(".mark-read-item-btn");
    if (btn) {
      btn.addEventListener("click", () => markSingleRead(notif.id));
    }

    notificationsList.appendChild(item);
  });
}

// Render pagination info
function renderPagination(meta) {
  if (meta.totalPages <= 1) {
    paginationControls.classList.add("hidden");
    return;
  }

  paginationControls.classList.remove("hidden");
  pageIndicator.textContent = `Page ${meta.currentPage} of ${meta.totalPages}`;
  prevPageBtn.disabled = !meta.hasPrevPage;
  nextPageBtn.disabled = !meta.hasNextPage;
}

// Mark single notification as read
async function markSingleRead(id) {
  try {
    const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${state.token}`,
      },
    });

    const data = await res.json();
    if (data.success) {
      // Find and update item style locally
      const index = state.notifications.findIndex((n) => n.id === id);
      if (index !== -1) {
        state.notifications[index].isRead = true;
      }
      
      // If we are on unread filter, we might want to just refetch
      if (state.currentFilter === "unread") {
        fetchNotifications();
      } else {
        const itemDom = document.getElementById(`notif-${id}`);
        if (itemDom) {
          itemDom.classList.remove("unread");
          itemDom.classList.add("read");
          const btn = itemDom.querySelector(".mark-read-item-btn");
          if (btn) btn.remove();
        }
      }
    }
  } catch (error) {
    console.error("Mark read error:", error);
  }
}

// Mark all as read
async function markAllRead() {
  try {
    const res = await fetch(`${API_BASE}/notifications/read-all`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${state.token}`,
      },
    });

    const data = await res.json();
    if (data.success) {
      showToast("success", "Success", "All notifications marked as read.");
      fetchNotifications();
    }
  } catch (error) {
    console.error("Mark all read error:", error);
  }
}

// Server-Sent Events Real-time Subscriber Setup
function setupRealtimeStream() {
  if (state.eventSource) {
    state.eventSource.close();
  }

  updateConnectionStatus("connecting");

  // Create stream connection with token query param
  state.eventSource = new EventSource(`${API_BASE}/notifications/stream?token=${encodeURIComponent(state.token)}`);

  state.eventSource.onopen = () => {
    updateConnectionStatus("connected");
  };

  state.eventSource.onerror = (err) => {
    console.error("SSE connection error:", err);
    updateConnectionStatus("disconnected");
  };

  state.eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      // Skip connection confirmation events
      if (data.status === "connected") {
        console.log("Real-time notifications stream active.");
        return;
      }

      // We received a real notification!
      handleIncomingRealtimeNotification(data);
    } catch (e) {
      console.error("Failed to parse SSE data:", e);
    }
  };
}

// Handle incoming SSE notification event
function handleIncomingRealtimeNotification(notification) {
  // Show toast notification banner
  showToast(notification.type, notification.title, notification.message);

  // Insert notification into list if filter conditions are met
  const matchesFilter =
    state.currentFilter === "all" ||
    (state.currentFilter === "unread" && !notification.isRead) ||
    (state.currentFilter === "read" && notification.isRead);

  if (matchesFilter) {
    // Add to state and re-render/refresh
    // Prepend to current screen array and cap length to pagination limit
    state.notifications.unshift(notification);
    if (state.notifications.length > 5) {
      state.notifications.pop();
    }
    renderNotificationsList();
  }
}

// Update connection badge indicator state
function updateConnectionStatus(status) {
  connStatusBadge.className = `connection-status-badge ${status}`;
  if (status === "connected") {
    connStatusBadge.textContent = "Live Connect";
  } else if (status === "connecting") {
    connStatusBadge.textContent = "Syncing...";
  } else {
    connStatusBadge.textContent = "Offline";
  }
}

// Dispatch Mock Notification via Simulator
async function handleSimulateNotification(e) {
  e.preventDefault();

  const targetUserId = simTargetSelect.value;
  const title = simTitleInput.value.trim();
  const message = simMessageInput.value.trim();
  const type = document.querySelector("input[name='sim-type']:checked").value;

  if (!targetUserId || !title || !message) return;

  try {
    const res = await fetch(`${API_BASE}/notifications/mock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({
        userId: targetUserId,
        title,
        message,
        type,
      }),
    });

    const data = await res.json();
    if (data.success) {
      // Clear form inputs
      simTitleInput.value = "";
      simMessageInput.value = "";
      
      // Flash Toast
      showToast("success", "Simulator", "Mock notification dispatched!");
    } else {
      showToast("error", "Simulator Failed", data.message || "Failed to dispatch.");
    }
  } catch (error) {
    console.error("Simulation dispatch error:", error);
    showToast("error", "Simulator Error", "Connection failed during dispatch.");
  }
}

// Render slide-in Toast message
function showToast(type, title, message) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const typeIcons = {
    info: "ℹ️",
    success: "✅",
    warning: "⚠️",
    error: "🚨",
  };
  const icon = typeIcons[type] || "🔔";

  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-content">
      <div class="toast-title">${escapeHTML(title)}</div>
      <div class="toast-message">${escapeHTML(message)}</div>
    </div>
    <button class="toast-close">&times;</button>
  `;

  // Close event handler
  const closeBtn = toast.querySelector(".toast-close");
  closeBtn.addEventListener("click", () => {
    toast.style.transform = "translateX(120%)";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  });

  toastContainer.appendChild(toast);

  // Play a light subtle audio beep (optional system audio)
  // Auto dismiss toast after 5 seconds
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.transform = "translateX(120%)";
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
}

// Utilities
function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
