# Stage 1: Notification System Design

This document details the REST API contract, JSON schemas, request/response headers, and real-time notification architecture designed for our front-end client applications.

---

## 1. System Overview & Core Actions

The notification platform is designed to store, manage, and push user-specific alerts. When a user is logged in, the system supports the following core actions:

1. **Retrieve User Notifications**: Get a paginated list of notifications for the currently logged-in user, filterable by read/unread status.
2. **Mark a Single Notification as Read**: Mark a specific notification as read by its unique identifier.
3. **Mark All Notifications as Read**: Mark all unread notifications belonging to the logged-in user as read in a single request.
4. **Subscribe to Real-Time Push Stream**: Establish a persistent, low-overhead server-to-client connection to receive notifications the moment they are triggered on the server.
5. **Trigger Mock Notification (Admin/Simulator)**: An endpoint to generate custom notifications for test accounts, broadcasting them immediately via the real-time channel.

---

## 2. Global Headers & Security

All REST requests to protected endpoints MUST include the following headers for client identification and security:

```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
Accept: application/json
```

- **Authorization**: JSON Web Token (JWT) issued upon authentication. It contains the user identity (`userId`, `username`) inside the encrypted payload.
- **Content-Type**: Declares that request body is JSON format.
- **Accept**: Declares that client expects JSON response.

---

## 3. API Contract and Endpoint Specifications

### A. Authentication: Mock Login
*Used to obtain a valid JWT token to test authorized requests.*

- **Endpoint**: `POST /api/auth/login`
- **Authentication Required**: No
- **Headers**:
  ```http
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "username": "alice"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user_alice_123",
      "username": "alice"
    }
  }
  ```

---

### B. Retrieve Notifications
*Fetches a paginated, filterable list of notifications for the logged-in user.*

- **Endpoint**: `GET /api/notifications`
- **Authentication Required**: Yes (`Bearer <token>`)
- **Query Parameters**:
  - `status` (string, optional): Filter by read status. Options: `unread`, `read`, `all` (default).
  - `page` (integer, optional): Current page number. Default is `1`.
  - `limit` (integer, optional): Number of notifications per page. Default is `10`.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "647f5bb1c58d04a60c0f8812",
        "title": "Payment Successful",
        "message": "Your transaction of $49.99 was processed successfully.",
        "type": "success",
        "isRead": false,
        "createdAt": "2026-06-26T11:20:00.000Z"
      }
    ],
    "pagination": {
      "totalItems": 15,
      "totalPages": 2,
      "currentPage": 1,
      "limit": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
  ```

---

### C. Mark Single Notification as Read
*Sets `isRead` to `true` for a single notification ID.*

- **Endpoint**: `PATCH /api/notifications/:id/read`
- **Authentication Required**: Yes (`Bearer <token>`)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Notification marked as read.",
    "data": {
      "id": "647f5bb1c58d04a60c0f8812",
      "title": "Payment Successful",
      "message": "Your transaction of $49.99 was processed successfully.",
      "type": "success",
      "isRead": true,
      "createdAt": "2026-06-26T11:20:00.000Z"
    }
  }
  ```
- **Error Response (404 Not Found)**:
  ```json
  {
    "success": false,
    "message": "Notification not found or access denied."
  }
  ```

---

### D. Mark All Notifications as Read
*Sets `isRead` to `true` for all notifications of the logged-in user.*

- **Endpoint**: `POST /api/notifications/read-all`
- **Authentication Required**: Yes (`Bearer <token>`)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Successfully marked 4 notifications as read."
  }
  ```

---

### E. Trigger Mock Notification (Simulator)
*Triggers and saves a custom notification. Instantly broadcasts it to the recipient's real-time connection.*

- **Endpoint**: `POST /api/notifications/mock`
- **Authentication Required**: Yes (`Bearer <token>`)
- **Request Body**:
  ```json
  {
    "userId": "user_alice_123",
    "title": "Security Alert",
    "message": "New login detected from a new IP address.",
    "type": "warning"
  }
  ```
  *(Supported `type` values: `info`, `success`, `warning`, `error`)*
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Notification triggered and broadcasted.",
    "data": {
      "id": "647f5cc2c58d04a60c0f8815",
      "userId": "user_alice_123",
      "title": "Security Alert",
      "message": "New login detected from a new IP address.",
      "type": "warning",
      "isRead": false,
      "createdAt": "2026-06-26T11:22:15.000Z"
    }
  }
  ```

---

## 4. Real-Time Push Mechanism: Server-Sent Events (SSE)

To meet the requirement for push-based real-time notifications when a user is logged in, we design and implement **Server-Sent Events (SSE)**. 

### Why Server-Sent Events (SSE)?
1. **HTTP/1.1 and HTTP/2 Native**: SSE operates over a single, long-lived standard HTTP connection. It works out-of-the-box with firewalls, API gateways, and proxies.
2. **Built-in Auto-reconnect**: The browser's native `EventSource` client automatically handles reconnection attempts if the connection drops, without writing custom reconnect loops.
3. **Uni-directional Streaming**: Notifications are server-to-client, which aligns perfectly with SSE. It is significantly lighter on resource usage than bi-directional WebSockets.

### SSE Endpoint Specification

- **Endpoint**: `GET /api/notifications/stream`
- **Authentication Required**: Yes (Token passed as query parameter due to standard browser `EventSource` header limitations: `GET /api/notifications/stream?token=<JWT_TOKEN>`)
- **Response Headers**:
  ```http
  Content-Type: text/event-stream
  Cache-Control: no-cache
  Connection: keep-alive
  ```

### Real-Time Event Schema
Once the SSE connection is established, notifications are pushed to the client using the standard `data:` format:

```sse
event: message
data: {
  "id": "647f5cc2c58d04a60c0f8815",
  "title": "Security Alert",
  "message": "New login detected from a new IP address.",
  "type": "warning",
  "isRead": false,
  "createdAt": "2026-06-26T11:22:15.000Z"
}
```

When the client receives this event, it increments the unread notification badge and presents a Toast alert to the user.

---

## Stage 2: Persistent Storage and Scaling Strategy

### 1. Database Selection & Choice Justification
For persisting notifications, we suggest using **MongoDB** (a document-oriented NoSQL database). 

**Key Reasons for Choosing MongoDB:**
- **Flexible Schema (Semi-structured data)**: Notification payloads vary widely. A security alert might have IP details, whereas a transactional update might have order links. JSON documents fit this variation naturally without complex JOIN tables.
- **Write Performance**: Notifications are write-intensive (lots of micro-services generating events). MongoDB provides high-throughput insert operations (especially with write concern configurations).
- **Scalability (Horizontal Sharding)**: Sharding by `userId` in MongoDB is native and simple. All notifications for a specific user reside on the same shard, which ensures extremely fast reads/writes for user notification boxes.
- **Time-to-Live (TTL) Indexes**: MongoDB has native support for TTL indexes. We can automatically prune/archive notifications that are read and older than 30 days without running custom Cron scripts.
- **Rich JSON Queries**: We can query nested arrays/objects easily.

*(Alternative: If strict ACID transactions and relational structures were required, PostgreSQL with a JSONB column would be the ideal RDBMS choice. However, for a high-volume notification feed, document storage is highly optimal.)*

---

### 2. Database Schema Design

We will represent notifications using the following schema (in MongoDB JSON Schema structure):

```json
{
  "bsonType": "object",
  "required": ["userId", "title", "message", "type", "isRead", "createdAt"],
  "properties": {
    "_id": {
      "bsonType": "objectId",
      "description": "Unique auto-generated MongoDB identifier"
    },
    "userId": {
      "bsonType": "string",
      "description": "ID of the recipient user (references the Users collection)"
    },
    "title": {
      "bsonType": "string",
      "maxLength": 100,
      "description": "Short heading of the notification"
    },
    "message": {
      "bsonType": "string",
      "maxLength": 1000,
      "description": "Detail message body of the notification"
    },
    "type": {
      "enum": ["info", "success", "warning", "error"],
      "description": "Notification category affecting severity and styling"
    },
    "isRead": {
      "bsonType": "bool",
      "description": "Status indicator if user opened/dismissed the alert"
    },
    "createdAt": {
      "bsonType": "date",
      "description": "Timestamp when the notification was created"
    }
  }
}
```

#### Indexes:
To guarantee quick reads and write operations, the following indexes are applied:
1. **Compound Index**: `{ userId: 1, isRead: 1, createdAt: -1 }`
   - *Purpose*: Optimizes the feed fetch endpoint `GET /api/notifications` which filters by `userId` and `isRead` status, sorting by `createdAt` in descending order.
2. **TTL Index**: `{ createdAt: 1 }` with `expireAfterSeconds: 2592000` (30 days)
   - *Purpose*: Automatically cleans up old history to control storage footprint.

---

### 3. Scaling Issues & Solutions

As the notification platform data volume increases, several key challenges arise:

#### Problem A: Slow Pagination (Large Page Offsets)
- *Details*: Fetching notifications using `limit` and `skip` (e.g. `skip(100000).limit(10)`) forces the database to scan all preceding documents before returning the target subset.
- *Solution*: Use **Keyset Pagination (Cursor-based Pagination)**. Instead of skipping offsets, queries check for entries older than a specific notification ID or timestamp (`createdAt < lastSeenTimestamp`).

#### Problem B: Huge Index Memory Usage
- *Details*: As the number of documents grows, indexes can grow larger than the server's RAM (Working Set), causing slow disk lookups.
- *Solution*: Use **Partial Indexes**. For example, index only *unread* notifications since read notifications are rarely queried:
  `db.notifications.createIndex({ userId: 1, createdAt: -1 }, { partialFilterExpression: { isRead: false } })`

#### Problem C: Write Saturation (Hotspots)
- *Details*: Millions of system actions trigger notifications simultaneously, locking DB tables or chocking disk I/O.
- *Solution*:
  1. **Message Queue / Buffer**: Push notifications to a queue (like Kafka or RabbitMQ) first, allowing a consumer service to throttle writes to the DB.
  2. **Sharding**: Horizontally partition/shard the database using `userId` as the shard key. This distributes the read and write loads across multiple physical database nodes.

#### Problem D: Disk Exhaustion
- *Details*: Retaining trillions of notifications forever chokes storage.
- *Solution*: Set up a **Data Tiering / Archiving Pipeline**. Move read notifications older than 7 days from the hot MongoDB store into cold cloud storage (e.g., AWS S3) for audit purposes, or use TTL indexes to discard them.

---

### 4. Database NoSQL Queries (MongoDB)

Based on the REST APIs designed in Stage 1, these are the corresponding MongoDB NoSQL queries:

#### A. Insert Notification (Mock Trigger)
*Saves a new notification to the database.*
```javascript
db.notifications.insertOne({
  userId: "user_alice_123",
  title: "Security Alert",
  message: "New login detected from a new IP address.",
  type: "warning",
  isRead: false,
  createdAt: new Date()
});
```

#### B. Fetch Notifications (Paginated & Filtered)
*Queries notifications for a specific user, sorted newest first, with cursor-based pagination.*

1. **Fetch Unread Notifications (First Page)**:
   ```javascript
   db.notifications.find({
     userId: "user_alice_123",
     isRead: false
   })
   .sort({ createdAt: -1 })
   .limit(10);
   ```

2. **Fetch Next Page (Cursor-based using `_id` and timestamp)**:
   ```javascript
   db.notifications.find({
     userId: "user_alice_123",
     isRead: false,
     createdAt: { $lt: ISODate("2026-06-26T11:20:00.000Z") }
   })
   .sort({ createdAt: -1 })
   .limit(10);
   ```

#### C. Mark Single Notification as Read
*Updates the status of a specific notification belonging to the logged-in user.*
```javascript
db.notifications.updateOne(
  {
    _id: ObjectId("647f5bb1c58d04a60c0f8812"),
    userId: "user_alice_123"
  },
  {
    $set: { isRead: true }
  }
);
```

#### D. Mark All Notifications as Read
*Sets `isRead: true` for all unread notifications for a specific user.*
```javascript
db.notifications.updateMany(
  {
    userId: "user_alice_123",
    isRead: false
  },
  {
    $set: { isRead: true }
  }
);
```

---

## Stage 3: Relational Database Query Analysis and Optimization

### 1. Analysis of the Query
The original query is:
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt ASC;
```

#### Accuracy Check:
- **Yes, it is accurate.** It correctly filters the notifications for a specific student (`studentID = 1042`), isolates only the unread ones (`isRead = false`), and sorts them in ascending order (`ORDER BY createdAt ASC`) so the student receives the oldest unread notifications first.

---

### 2. Performance Analysis: Why is the query slow?
At 5,000,000 notifications and 50,000 students, this query is suffering from two major bottlenecks:

1. **Full Table Scan or Sub-optimal Index Lookup**:
   - Without a specific compound index, the database engine has to scan all 5,000,000 rows to find those matching the conditions, which is an \(O(N)\) complexity.
   - If there is only a single-column index on `studentID`, the engine retrieves all notifications for that student (average of 100 rows per student), but must then filter by `isRead = false` manually and sort them afterwards.
   - If there is only a single-column index on `isRead`, it is highly inefficient because `isRead` has extremely **low cardinality** (only two values: true/false). Filtering on it returns ~50% of the database (~2,500,000 rows), making index scanning slower than a sequential table read.
2. **In-Memory Sorting (Filesort)**:
   - Since the query contains `ORDER BY createdAt ASC`, if the index does not provide pre-sorted ordering for the target subset, the database must copy the filtered rows into a temporary buffer (Sort Buffer) and run an in-memory sort algorithm (like Quicksort, \(O(M \log M)\) where \(M\) is the number of matching records). If the buffer fills up, it writes temp files to disk, causing high disk I/O latency.

---

### 3. Recommended Optimization & Computational Cost

#### Proposed Change:
To make this query execute in sub-millisecond times, we should create a **Compound (Composite) Index** on the table:
```sql
CREATE INDEX idx_notifications_student_unread_created 
ON notifications (studentID, isRead, createdAt ASC);
```

**Why this compound index works:**
- **Filtering (Equality)**: The engine first matches `studentID` (high cardinality) to shrink the search space immediately.
- **Refinement**: It then matches `isRead` within that student's records.
- **Sorting**: Finally, because `createdAt ASC` is the last column in the compound index, the records are already sorted on disk by creation date. The database optimizer completely skips the in-memory sorting step.

*(Alternative for PostgreSQL only)*:
If the database is PostgreSQL, we can use a **Partial Index** to minimize disk space, since we only query unread notifications:
```sql
CREATE INDEX idx_notifications_student_unread_partial 
ON notifications (studentID, createdAt ASC) 
WHERE isRead = false;
```
This is even more efficient as it reduces index bloat.

#### Computation Cost Comparison:
- **Before Optimization (Full Table Scan + Filesort)**:
  - Time Complexity: \(O(N) + O(M \log M)\) where \(N = 5,000,000\) database rows and \(M\) is the student's notification count.
  - Disk/RAM cost: High CPU utilization due to scanning pages and high RAM sorting buffer usage.
- **After Optimization (Compound Index Scan)**:
  - Time Complexity: \(O(\log N) + O(K)\) where \(K\) is the number of unread notifications matching the filter (usually very small).
  - Disk/RAM cost: Negligible. The lookup runs as a direct B-Tree traversal.

---

### 4. Evaluation of "Index on Every Column" Strategy
A team member suggested adding indexes on every column separately to be "safe".

**This advice is NOT effective and is highly counter-productive.**

#### Why?
1. **Write Performance Degradation**: Every time a notification is created, read, or deleted, **every single index** must be updated (B-Tree splits/re-balancing). This turns fast insertions into bottleneck operations.
2. **Database Optimizer Limitations**: The SQL optimizer can generally use only one index per table access in a query. Having individual indexes on `studentID`, `isRead`, and `createdAt` means the optimizer has to choose one sub-optimal index, perform a scan, and discard the others. It does *not* behave like a compound index.
3. **Storage and RAM Bloat**: Indexes are stored in memory (e.g., InnoDB Buffer Pool in MySQL). Indexing every column wastes gigabytes of RAM. If index metadata exceeds the available memory, database performance crashes because pages must be constantly swapped from disk.

---

### 5. SQL Query: Placement Notifications in the Last 7 Days

To fetch all unique students who received a placement notification (`notificationType = 'Placement'`) within the last 7 days:

#### PostgreSQL/MySQL Query:
```sql
SELECT DISTINCT studentID 
FROM notifications
WHERE notificationType = 'Placement'
  AND createdAt >= NOW() - INTERVAL '7 days';
```

*(Note: In MySQL, this can also be written as `createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)`).*

#### To optimize this query, we should add the following compound index:
```sql
CREATE INDEX idx_notifications_type_created 
ON notifications (notificationType, createdAt);
```

---

## Stage 4: Database Offloading and Caching Strategies

When notifications are fetched on every page load for every student, the database faces severe read amplification. This degrades database response times, exhausts connection pools, and compromises the user experience. 

Below are three main strategies to resolve this bottleneck, along with their implementation code and trade-offs.

---

### Strategy 1: Server-Side Cache-Aside (e.g., Redis)

#### Implementation Concept:
We place an in-memory key-value cache (Redis) in front of the primary database.
- **On Reads (`GET /api/notifications`)**: The application checks Redis first. On a *Cache Hit*, it returns the cached JSON array instantly. On a *Cache Miss*, it queries the primary database, populates the Redis cache with a Time-To-Live (TTL) configuration, and returns the response.
- **On Writes/Updates (e.g., marking read, new notification)**: The application updates the primary database and **invalidates (deletes)** the user's cached keys, ensuring read consistency.

#### Server-Side Implementation Code (Node.js/Express + ioredis):

```javascript
import Redis from "ioredis";
import Notification from "../models/Notification.js";

// Initialize Redis Client
const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: 6379,
});

/**
 * Controller to fetch notifications with Redis caching
 */
export const getNotifications = async (req, res) => {
  const userId = req.user.id;
  const { status = "all", page = 1, limit = 5 } = req.query;
  
  // Construct a unique cache key for this user's specific query parameters
  const cacheKey = `notifications:${userId}:${status}:p:${page}:l:${limit}`;

  try {
    // 1. Attempt to fetch from Redis
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log(`⚡ [Redis Cache HIT] Serving feed for user: ${userId}`);
      return res.json(JSON.parse(cachedData));
    }

    console.log(`🐢 [Redis Cache MISS] Querying primary database for user: ${userId}`);

    // 2. Query Primary Database (using optimized query patterns from Stage 3)
    const query = { userId };
    if (status === "read") query.isRead = true;
    else if (status === "unread") query.isRead = false;

    const totalItems = await Notification.countDocuments(query);
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const responsePayload = {
      success: true,
      data: notifications,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: parseInt(page),
      },
    };

    // 3. Save to Redis with a TTL of 10 minutes (600 seconds)
    await redis.setex(cacheKey, 600, JSON.stringify(responsePayload));

    return res.json(responsePayload);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Invalidation Helper: Deletes cache keys whenever a write/update occurs
 */
export const invalidateUserNotificationsCache = async (userId) => {
  try {
    // Locate all paginated/filtered keys for the specific user
    const keys = await redis.keys(`notifications:${userId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`🧹 [Cache Invalidation] Cleared ${keys.length} keys for user: ${userId}`);
    }
  } catch (error) {
    console.error("❌ Redis Cache Invalidation Error:", error.message);
  }
};
```

---

### Strategy 2: Event-Driven Real-Time Push & Client State Caching

#### Implementation Concept:
Instead of fetching notifications on every page load/navigation:
1. The frontend fetches notifications **once** on the initial session load.
2. The client retains this list in local application state (in-memory or synced to `localStorage`).
3. The client opens a persistent SSE (Server-Sent Events) or WebSocket connection.
4. When a new notification occurs, the server sends it over the SSE socket, and the client updates its local state dynamically.
5. Databases reads are reduced to exactly **once per login session** instead of once per page click.

#### Client-Side State Management Code (Vanilla JavaScript):

```javascript
// Local cache state
let clientNotificationCache = {
  feed: [],
  hasLoadedOnce: false,
};

/**
 * Loads notifications from network if cache is empty, otherwise serves local cache
 */
async function loadNotificationCenter() {
  const container = document.getElementById("notifications-list");

  // If already loaded in this session, render from local cache directly (0 DB reads!)
  if (clientNotificationCache.hasLoadedOnce) {
    console.log("📦 Serving notification feed from client-side state cache.");
    renderList(clientNotificationCache.feed);
    return;
  }

  // First-time load: Fetch from API and populate local cache
  try {
    const response = await fetch("/api/notifications?status=all", {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    const result = await response.json();
    
    if (result.success) {
      clientNotificationCache.feed = result.data;
      clientNotificationCache.hasLoadedOnce = true;
      renderList(clientNotificationCache.feed);
    }
  } catch (e) {
    console.error("Failed to load initial notifications:", e);
  }
}

/**
 * Real-time SSE Stream Listener
 * Listens for server pushes and injects them directly into local state
 */
function listenToPushStream() {
  const eventSource = new EventSource(`/api/notifications/stream?token=${userToken}`);

  eventSource.onmessage = (event) => {
    const newNotification = JSON.parse(event.data);
    
    // 1. Prepend the incoming push directly to our client-side cache
    clientNotificationCache.feed.unshift(newNotification);
    
    // 2. Re-render the UI dynamically (without querying the database!)
    renderList(clientNotificationCache.feed);
    showToastAlert(newNotification);
  };
}
```

---

### Strategy 3: HTTP Conditional Requests (`ETag` / `Last-Modified`)

#### Implementation Concept:
The web browser requests notifications and receives an HTTP header called `ETag` (usually a hash of the content or the last modified timestamp). On subsequent page loads, the browser sends `If-None-Match: <ETag>`. The server checks if the user's notification state has changed. If not, it returns `304 Not Modified` with **zero payload body**, avoiding serialization and network traffic overhead.

#### Server-Side ETag Express Code:

```javascript
import crypto from "crypto";

export const getNotificationsETag = async (req, res) => {
  const userId = req.user.id;

  try {
    // 1. Perform a ultra-fast query to get the count and latest timestamp
    // This is substantially cheaper than fetching and serializing full document bodies.
    const latestNotif = await Notification.findOne({ userId })
      .sort({ updatedAt: -1 })
      .select("updatedAt");
      
    const count = await Notification.countDocuments({ userId });
    
    // 2. Generate a fingerprint hash
    const lastUpdated = latestNotif ? latestNotif.updatedAt.getTime() : 0;
    const fingerprint = crypto
      .createHash("md5")
      .update(`${userId}:${count}:${lastUpdated}`)
      .digest("hex");

    // 3. Check if client sent matching ETag
    if (req.headers["if-none-match"] === fingerprint) {
      console.log("🚀 ETag Hit: Client already has the latest feed. Returning 304.");
      return res.status(304).end();
    }

    // 4. Fetch full data if ETag is a miss
    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 });
    
    res.setHeader("ETag", fingerprint);
    return res.json({ success: true, data: notifications });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
```

---

### Trade-Offs Matrix

| Strategy | DB Offload Level | Complexity | Real-time Consistency | Infrastructure Cost |
| :--- | :--- | :--- | :--- | :--- |
| **Server-Side Redis Caching** | **High** (Offloads ~90% reads) | Medium | High (If invalidation is written correctly) | Medium (Requires running Redis instance) |
| **Real-time Push + Client Cache** | **Extreme** (Reads only once per session) | High (Client-server state syncing) | Instantaneous | Low (Standard connections, SSE/WebSockets) |
| **HTTP ETag Conditional GET** | Low-Medium (Avoids payload generation) | Low (Uses standard HTTP) | High | None |
| **Database Read Replicas** | High (Offloads reads to other nodes) | High (CQRS, connection router) | Eventual (Replication lag delays) | High (Multiple DB servers/licensing) |

### Recommended Action Plan:
1. **Primary Solution**: Implement **Server-Side Redis Caching** to safeguard database connections from duplicate reads.
2. **Developer Best Practice**: Combine it with the **SSE Real-Time Stream** implemented in Stage 1 to enable client-side updates, rendering page-load database calls almost entirely obsolete.


