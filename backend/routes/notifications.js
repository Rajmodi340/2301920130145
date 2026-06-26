import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import { authMiddleware, JWT_SECRET } from "../middleware/auth.js";

const router = express.Router();

// Map to store active SSE connections by userId
// Key: userId (string), Value: Array of Express Response objects
export const activeStreams = new Map();

// In-memory fallback database for when MongoDB is disconnected or not whitelisted
const memoryNotifications = [];

// Helper to check MongoDB connection status
const isDbConnected = () => mongoose.connection.readyState === 1;

// Helper to push a notification in real-time to a user's open streams
export const pushNotificationToUser = (userId, notification) => {
  const streams = activeStreams.get(userId);
  if (streams && streams.length > 0) {
    console.log(`📡 Pushing real-time notification to user: ${userId} (${streams.length} active connection(s))`);
    // Check if notification has standard Mongoose toJSON or is a plain object
    const dataObj = notification.toJSON ? notification.toJSON() : notification;
    const data = JSON.stringify(dataObj);
    streams.forEach((res) => {
      res.write(`data: ${data}\n\n`);
    });
  }
};

/**
 * SSE Subscription Endpoint
 * Note: Browser EventSource doesn't support headers, so we authenticate via ?token=...
 */
router.get("/stream", (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.status(401).json({ success: false, message: "Token is required." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    // Set headers for Server-Sent Events
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Register stream
    if (!activeStreams.has(userId)) {
      activeStreams.set(userId, []);
    }
    activeStreams.get(userId).push(res);

    console.log(`🔌 SSE Connection established for user: ${userId}`);

    // Send a connection confirmation event
    res.write(`data: ${JSON.stringify({ status: "connected", userId })}\n\n`);

    // Keep connection alive by sending comments periodically
    const keepAliveInterval = setInterval(() => {
      res.write(": keepalive\n\n");
    }, 30000);

    // Clean up when client disconnects
    req.on("close", () => {
      clearInterval(keepAliveInterval);
      const connections = activeStreams.get(userId) || [];
      const updatedConnections = connections.filter((conn) => conn !== res);
      
      if (updatedConnections.length === 0) {
        activeStreams.delete(userId);
      } else {
        activeStreams.set(userId, updatedConnections);
      }
      console.log(`🔌 SSE Connection closed for user: ${userId}`);
    });

  } catch (error) {
    return res.status(403).json({ success: false, message: "Invalid or expired token." });
  }
});

/**
 * Retrieve User Notifications (Paginated and Filterable)
 * GET /api/notifications?status=all|read|unread&page=1&limit=10
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { status = "all", page = 1, limit = 10 } = req.query;
    
    // Parse query params
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Build query conditions
    const query = { userId: req.user.id };
    if (status === "read") {
      query.isRead = true;
    } else if (status === "unread") {
      query.isRead = false;
    }

    let notifications = [];
    let totalItems = 0;

    if (isDbConnected()) {
      totalItems = await Notification.countDocuments(query);
      notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);
    } else {
      console.log("⚠️ [In-Memory Mode] Retrieving notifications from local store.");
      let filtered = memoryNotifications.filter((n) => n.userId === query.userId);
      if (query.isRead !== undefined) {
        filtered = filtered.filter((n) => n.isRead === query.isRead);
      }
      totalItems = filtered.length;
      // Sort by creation date descending
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      notifications = filtered.slice(skip, skip + limitNum);
    }

    const totalPages = Math.ceil(totalItems / limitNum);

    return res.json({
      success: true,
      data: notifications,
      pagination: {
        totalItems,
        totalPages,
        currentPage: pageNum,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error retrieving notifications.",
      error: error.message,
    });
  }
});

/**
 * Mark a Single Notification as Read
 * PATCH /api/notifications/:id/read
 */
router.patch("/:id/read", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    let notification;

    if (isDbConnected()) {
      notification = await Notification.findOneAndUpdate(
        { _id: id, userId: req.user.id },
        { isRead: true },
        { new: true }
      );
    } else {
      console.log(`⚠️ [In-Memory Mode] Marking notification read: ${id}`);
      const found = memoryNotifications.find((n) => n.id === id && n.userId === req.user.id);
      if (found) {
        found.isRead = true;
        notification = found;
      }
    }

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found or access denied.",
      });
    }

    return res.json({
      success: true,
      message: "Notification marked as read.",
      data: notification,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error marking notification as read.",
      error: error.message,
    });
  }
});

/**
 * Mark All Notifications as Read
 * POST /api/notifications/read-all
 */
router.post("/read-all", authMiddleware, async (req, res) => {
  try {
    let modifiedCount = 0;

    if (isDbConnected()) {
      const result = await Notification.updateMany(
        { userId: req.user.id, isRead: false },
        { isRead: true }
      );
      modifiedCount = result.modifiedCount;
    } else {
      console.log(`⚠️ [In-Memory Mode] Marking all notifications read for user: ${req.user.id}`);
      memoryNotifications.forEach((n) => {
        if (n.userId === req.user.id && !n.isRead) {
          n.isRead = true;
          modifiedCount++;
        }
      });
    }

    return res.json({
      success: true,
      message: `Successfully marked ${modifiedCount} notifications as read.`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error marking all notifications as read.",
      error: error.message,
    });
  }
});

/**
 * Create/Trigger a Mock Notification (Simulation Endpoint)
 * POST /api/notifications/mock
 */
router.post("/mock", authMiddleware, async (req, res) => {
  try {
    const { userId, title, message, type = "info" } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({
        success: false,
        message: "userId, title, and message are required fields.",
      });
    }

    let newNotification;

    if (isDbConnected()) {
      newNotification = new Notification({
        userId,
        title,
        message,
        type,
      });
      await newNotification.save();
    } else {
      console.log(`⚠️ [In-Memory Mode] Creating new notification for user: ${userId}`);
      newNotification = {
        id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        title,
        message,
        type,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      memoryNotifications.push(newNotification);
    }

    // Push via SSE stream
    pushNotificationToUser(userId, newNotification);

    return res.status(201).json({
      success: true,
      message: "Notification triggered and broadcasted.",
      data: newNotification,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error creating mock notification.",
      error: error.message,
    });
  }
});

export default router;
