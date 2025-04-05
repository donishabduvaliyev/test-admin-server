// middleware/auth.js
import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ message: "Access Denied. No Token Provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret");
    req.admin = decoded; // Save admin info in request
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};
