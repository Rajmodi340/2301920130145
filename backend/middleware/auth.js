import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "notification_app_secret_key_123";

export const authMiddleware = (req, res, next) => {
  // Check authorization header
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Contains id, username
    next();
  } catch (error) {
    res.status(403).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};

// Export secret for route signing
export { JWT_SECRET };
