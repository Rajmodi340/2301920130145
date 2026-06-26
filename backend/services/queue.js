import Redis from "ioredis";
import { Queue, Worker } from "bullmq";
import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import { pushNotificationToUser } from "../routes/notifications.js";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
let redisClient = null;
let isRedisConnected = false;
let bullQueue = null;
let bullWorker = null;

// Initialize Redis client and BullMQ if possible
try {
  redisClient = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 2000,
  });

  redisClient.on("connect", () => {
    console.log("✅ [Queue Service] Redis connected successfully. BullMQ enabled.");
    isRedisConnected = true;
  });

  redisClient.on("error", (err) => {
    console.warn("⚠️ [Queue Service] Redis connection error. Using in-memory queue fallback.");
    isRedisConnected = false;
  });
} catch (e) {
  console.warn("⚠️ [Queue Service] Redis initialization failed. Using in-memory queue fallback.");
}

// In-memory queue fallback for concurrency control
class MemoryQueue {
  constructor(concurrency = 20) {
    this.concurrency = concurrency;
    this.running = 0;
    this.tasks = [];
  }

  add(taskFn) {
    this.tasks.push(taskFn);
    this.next();
  }

  next() {
    while (this.running < this.concurrency && this.tasks.length > 0) {
      const task = this.tasks.shift();
      this.running++;
      task().finally(() => {
        this.running--;
        this.next();
      });
    }
  }
}

const localQueue = new MemoryQueue(20);

// In-memory database buffer for batch inserts
let dbBuffer = [];
const BATCH_SIZE = 100;
let flushTimeout = null;

// Helper to batch-save notification records
export const batchSaveNotification = async (record) => {
  dbBuffer.push(record);
  
  if (dbBuffer.length >= BATCH_SIZE) {
    await flushDatabaseBuffer();
  } else if (!flushTimeout) {
    flushTimeout = setTimeout(async () => {
      await flushDatabaseBuffer();
    }, 1000);
  }
};

// Flush accumulated buffer to MongoDB or Memory Store
async function flushDatabaseBuffer() {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
  
  if (dbBuffer.length === 0) return;
  
  const batchToInsert = [...dbBuffer];
  dbBuffer = []; // Clear immediately to avoid duplicate insertions
  
  try {
    if (mongoose.connection.readyState === 1) {
      await Notification.insertMany(batchToInsert);
      console.log(`💾 [Batch DB] Successfully saved ${batchToInsert.length} notifications to MongoDB.`);
    } else {
      // Import the in-memory array from notifications route
      // We can append it to the routes memory fallback
      const { appendMemoryNotifications } = await import("../routes/notifications.js");
      appendMemoryNotifications(batchToInsert);
      console.log(`💾 [Batch Memory] Successfully saved ${batchToInsert.length} notifications to in-memory store.`);
    }
  } catch (error) {
    console.error("❌ [Batch Save Error] Failed to write bulk notifications:", error.message);
  }
}

// Core task executor
const executeTask = async (studentId, title, message) => {
  // Simulate slow email API delivery (takes 50ms)
  await new Promise((resolve) => setTimeout(resolve, 50));

  const notificationRecord = {
    userId: studentId,
    title,
    message,
    type: "info",
    isRead: false,
    createdAt: new Date(),
  };

  // 1. Save in batches
  await batchSaveNotification(notificationRecord);

  // 2. Broadcast via SSE in real-time
  pushNotificationToUser(studentId, notificationRecord);
};

// Initialize BullMQ components if Redis ready
const initBullMQ = () => {
  if (!bullQueue && isRedisConnected && redisClient) {
    bullQueue = new Queue("notification-delivery", {
      connection: redisClient
    });

    bullWorker = new Worker("notification-delivery", async (job) => {
      const { studentId, title, message } = job.data;
      await executeTask(studentId, title, message);
    }, {
      connection: redisClient,
      concurrency: 50
    });

    console.log("⚙️ [Queue Service] BullMQ Queue & Worker initialized.");
  }
};

// Dispatch bulk notifications API
export const dispatchBulkNotifications = async (studentIds, title, message) => {
  // Attempt to load BullMQ components if Redis connected
  if (isRedisConnected && !bullQueue) {
    initBullMQ();
  }

  if (isRedisConnected && bullQueue) {
    console.log(`🚀 [Queue Service] Enqueuing ${studentIds.length} tasks via BullMQ.`);
    const jobs = studentIds.map((studentId) => ({
      name: "dispatch-notification",
      data: { studentId, title, message },
      opts: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: true
      }
    }));
    
    // Add in chunks of 1000 to keep it memory-efficient
    const chunkSize = 1000;
    for (let i = 0; i < jobs.length; i += chunkSize) {
      const chunk = jobs.slice(i, i + chunkSize);
      await bullQueue.addBulk(chunk);
    }
    console.log("✅ [Queue Service] BullMQ bulk scheduling completed.");
  } else {
    console.log(`🚀 [Queue Service] Redis offline. Enqueuing ${studentIds.length} tasks via LocalMemoryQueue.`);
    studentIds.forEach((studentId) => {
      localQueue.add(() => executeTask(studentId, title, message));
    });
    console.log("✅ [Queue Service] LocalMemoryQueue scheduling completed.");
  }
};
