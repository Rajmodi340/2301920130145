/**
 * Priority Inbox - Calculation Examples and Test Data
 * 
 * This file demonstrates how the priority scoring system works
 * and provides sample test data
 */

// ============================================================
// PRIORITY CALCULATION FORMULA
// ============================================================
/**
 * Priority Score = (Type Weight × 100) + Recency Score
 * 
 * Type Weight:
 * - placement: 3 (highest importance)
 * - result: 2 (medium importance)
 * - event: 1 (low importance)
 * 
 * Recency Score (0-100):
 * - Notifications from today: ~90-100
 * - Notifications from 1 day ago: ~80-90
 * - Notifications from 2-3 days: ~50-80
 * - Notifications from 1+ week: <50
 * 
 * Example Scores:
 * - Recent placement notification: (3 × 100) + 98 = 398 (HIGHEST)
 * - Recent result notification: (2 × 100) + 98 = 298 (HIGH)
 * - Recent event notification: (1 × 100) + 98 = 198 (NORMAL)
 * - Old placement notification: (3 × 100) + 10 = 310 (still high due to type)
 * - Old result notification: (2 × 100) + 10 = 210 (medium)
 * - Old event notification: (1 × 100) + 10 = 110 (LOW)
 */

// ============================================================
// TEST DATA EXAMPLES
// ============================================================

const sampleNotifications = [
  // High Priority: Recent Placement Notifications
  {
    id: "notif_001",
    title: "Google Campus Recruitment",
    description: "Google is visiting campus on July 5th. Apply now for internship positions!",
    type: "placement",
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
    read: false,
    priority: 398 // (3×100) + 98
  },
  {
    id: "notif_002",
    title: "Microsoft Hiring Event",
    description: "Microsoft is recruiting for software engineer roles. Registration required.",
    type: "placement",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    read: false,
    priority: 397 // (3×100) + 97
  },
  
  // High Priority: Recent Result Notifications
  {
    id: "notif_003",
    title: "Exam Results Available",
    description: "Your DSA exam results have been posted. Check your dashboard.",
    type: "result",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(), // 1 hour ago
    read: false,
    priority: 298 // (2×100) + 98
  },
  {
    id: "notif_004",
    title: "Assignment Grade Updated",
    description: "Assignment 3 has been graded. Score: 45/50",
    type: "result",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
    read: false,
    priority: 295 // (2×100) + 95
  },
  
  // Medium Priority: Events
  {
    id: "notif_005",
    title: "Hackathon Registration Open",
    description: "CodeNite 2024 registration is now open. Register your team!",
    type: "event",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
    read: false,
    priority: 194 // (1×100) + 94
  },
  
  // Medium Priority: Older Placement
  {
    id: "notif_006",
    title: "Amazon Interview Schedule",
    description: "Your Amazon interview is scheduled for next week.",
    type: "placement",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
    read: false,
    priority: 340 // (3×100) + 40
  },
  
  // Low Priority: Older Events
  {
    id: "notif_007",
    title: "Club Meeting Reminder",
    description: "Developer club meeting this Friday at 4 PM.",
    type: "event",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
    read: false,
    priority: 130 // (1×100) + 30
  },
  
  // Very Low Priority: Very Old Events
  {
    id: "notif_008",
    title: "Welcome to Campus",
    description: "Welcome to our platform. Explore your dashboard.",
    type: "event",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(), // 10 days ago
    read: true,
    priority: 100 // (1×100) + 0 (very old)
  },
  
  // Additional notifications for testing (ranked by priority)
  {
    id: "notif_009",
    title: "Accenture Selection Round Results",
    description: "Congratulations! You've been selected for the technical round.",
    type: "placement",
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 min ago
    read: false,
    priority: 397 // (3×100) + 97
  },
  
  {
    id: "notif_010",
    title: "Internship Offer Extended",
    description: "Goldman Sachs has extended an internship offer. Review the terms.",
    type: "placement",
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(), // 1.5 hours ago
    read: false,
    priority: 396 // (3×100) + 96
  },
  
  {
    id: "notif_011",
    title: "Quiz Results Posted",
    description: "Quiz 2 results are available. Score: 28/30",
    type: "result",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
    read: false,
    priority: 293 // (2×100) + 93
  },
  
  {
    id: "notif_012",
    title: "Course Materials Updated",
    description: "Lecture notes for Week 5 have been uploaded.",
    type: "event",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
    read: false,
    priority: 192 // (1×100) + 92
  }
];

// ============================================================
// EXPECTED TOP 10 RANKING (by priority score)
// ============================================================

const expectedTop10 = [
  "notif_001", // 398
  "notif_009", // 397
  "notif_002", // 397
  "notif_010", // 396
  "notif_003", // 298
  "notif_004", // 295
  "notif_011", // 293
  "notif_005", // 194
  "notif_012", // 192
  "notif_006"  // 340 - Wait, this should be higher
];

// Actually corrected ranking (sorted by priority descending):
const correctedTop10 = [
  { id: "notif_001", score: 398 }, // Recent Google placement
  { id: "notif_009", score: 397 }, // Recent Accenture placement
  { id: "notif_002", score: 397 }, // Recent Microsoft placement
  { id: "notif_010", score: 396 }, // Recent Goldman Sachs offer
  { id: "notif_006", score: 340 }, // 2-day old Amazon interview (still high)
  { id: "notif_003", score: 298 }, // Recent exam results
  { id: "notif_004", score: 295 }, // Recent assignment grade
  { id: "notif_011", score: 293 }, // Recent quiz results
  { id: "notif_005", score: 194 }, // Hackathon event (4h ago)
  { id: "notif_012", score: 192 }  // Course materials (6h ago)
];

// ============================================================
// KEY INSIGHTS
// ============================================================

/**
 * How the system maintains top 10 efficiently:
 * 
 * 1. FILTERING: Only unread notifications are considered
 *    - Read notifications are never in top 10
 *    - Can mark as read to remove from priority inbox
 * 
 * 2. WEIGHT-BASED SORTING: Type weight is primary factor
 *    - Placement notifications dominate top rankings
 *    - Recent placements always rank higher than old events
 *    - Result notifications rank above events
 * 
 * 3. RECENCY BONUS: Newer is better (but type matters more)
 *    - A 2-day old placement (340) ranks above recent events (194)
 *    - Ensures urgent placement info never gets buried
 *    - Events decay faster but don't lose all priority
 * 
 * 4. SCALABILITY: O(n log n) complexity
 *    - Sort once, take first 10
 *    - Can handle thousands of notifications
 *    - Cache results for 5 minutes
 * 
 * 5. CONSTANT UPDATES: As new notifications arrive
 *    - System automatically ranks them
 *    - High-priority items bubble to top
 *    - Low-priority old items drop down
 *    - Every 2 minutes: auto-refresh
 *    - Manual refresh available anytime
 */

// ============================================================
// TESTING QUERIES
// ============================================================

/**
 * Questions to test the system:
 * 
 * 1. Are placement notifications dominating the top?
 *    Answer: Yes - they have 3× weight
 * 
 * 2. Do recent notifications rank higher?
 *    Answer: Yes for same type, but older placement > newer event
 * 
 * 3. How long does a notification stay in top 10?
 *    Answer: Depends on type and competition:
 *    - Placement: 2-3 days typically
 *    - Result: 1-2 days typically
 *    - Event: Few hours typically
 * 
 * 4. Can you hide old notifications?
 *    Answer: Yes, mark as read
 * 
 * 5. What if no unread notifications?
 *    Answer: Shows "No unread notifications" message
 */

console.log("Priority Inbox Test Data Loaded");
console.log("Sample Notifications:", sampleNotifications.length);
console.log("Expected Top 10:", correctedTop10);
