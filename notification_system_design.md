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
