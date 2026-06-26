import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import notificationRoutes from "./routes/notifications.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📡 [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/notifications", notificationRoutes);

console.log("🔍 MONGO_URL:", process.env.MONGO_URL ? "Loaded ✓" : "NOT FOUND ✗");

// Connect to MongoDB
async function connectDB() {
  try {
    console.log("🔄 Attempting to connect to MongoDB...");
    await mongoose.connect(process.env.MONGO_URL, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("✅ Connected to MongoDB Successfully!");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    // Continue anyway - server can still run
  }
}

connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});