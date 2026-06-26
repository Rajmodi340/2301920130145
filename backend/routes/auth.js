import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../middleware/auth.js";

const router = express.Router();

router.post("/login", (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({
      success: false,
      message: "Username is required.",
    });
  }

  // Create a clean user ID based on name for predictability
  const cleanUsername = username.trim().toLowerCase();
  const userId = `user_${cleanUsername}_123`;

  // Sign JWT
  const token = jwt.sign(
    { id: userId, username: cleanUsername },
    JWT_SECRET,
    { expiresIn: "24h" }
  );

  return res.json({
    success: true,
    token,
    user: {
      id: userId,
      username: cleanUsername,
    },
  });
});

export default router;
