import foodRoutes from "./routes/foodRoutes.js";
import "dotenv/config";

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cron from "node-cron";
// Ensure this path is correct relative to your server.js file
import recieveOrder from "./routes/recieveOrder.js";
import analytics from "./routes/analytics.js";
const { router: analyticsRoutes, updateDashboardAnalyticsDocument } = analytics;

// Define the timezone for consistency
const TIMEZONE = "Asia/Tashkent";

const app = express();

// --- Core Middleware ---
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// --- CORS Configuration ---
const allowedOrigins = [
  "http://localhost:5174",
  "http://localhost:5173",
  "https://test-bot-admin.netlify.app",
  "https://web.telegram.org",
  "http://localhost:5000"
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `CORS policy blocks this origin: ${origin}`;
      console.warn(msg); // Log blocked origins
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE"], // Allowed HTTP methods
  allowedHeaders: ["Content-Type", "Authorization"], // Allowed headers
  credentials: false // Typically false unless dealing with cookies/sessions across origins
}));

// --- Database Connection ---
// Check if MONGO_URI is loaded
if (!process.env.MONGO_URI) {
  console.error("FATAL ERROR: MONGO_URI is not defined in the environment variables.");
  process.exit(1); // Exit if database URI is missing
}

mongoose
  .connect(process.env.MONGO_URI) // Removed deprecated options
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1); // Exit on connection failure
  });

// Enable Mongoose debug logging (useful during development)
mongoose.set("debug", process.env.NODE_ENV !== 'production'); // Only debug if not in production

// --- Base Route ---
app.get("/", (req, res) => {
  res.send("✅ Restaurant Analytics API Server is running!");
});

// --- Application Routes ---
app.use("/api/food", foodRoutes); // Mount food-related routes
app.use('/api/analytics', analyticsRoutes);
app.use("/api/recieve-order" , recieveOrder) // Mount analytics routes

// --- Scheduled Cron Job for Analytics ---
console.log(`Scheduling daily analytics update for timezone: ${TIMEZONE}`);
// Schedule format: 'minute hour day(month) month day(week)'
// '5 0 * * *' means 00:05 (5 minutes past midnight) every day
cron.schedule('5 0 * * *', () => {
  console.log(`[${new Date().toISOString()}] Running scheduled daily analytics update...`);
  // Call the exported update function and handle potential errors
  updateDashboardAnalyticsDocument().catch(err => {
    console.error(`[${new Date().toISOString()}] Error during scheduled analytics update:`, err);
  });
}, {
  scheduled: true,
  timezone: TIMEZONE // Ensure the schedule runs according to the specified timezone
});

// --- 404 Not Found Handler ---
// This middleware should be placed AFTER all your routes but BEFORE the global error handler.
// It catches requests that didn't match any defined route.
app.use((req, res, next) => {
  res.status(404).json({ message: `Resource not found at ${req.originalUrl}` });
});

// --- Global Error Handler ---
// This middleware catches errors thrown in any preceding middleware or route handlers.
// It MUST have 4 arguments (err, req, res, next) to be recognized as an error handler.
app.use((err, req, res, next) => {
  console.error("Global Error Handler Caught:", err.stack); // Log the full error stack
  const statusCode = err.status || 500; // Use error status or default to 500
  res.status(statusCode).json({
    message: statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'An internal server error occurred.' // Generic message in production
      : err.message // More specific message in development
  });
});

// --- Start Server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running successfully on port ${PORT}`);
  // Optional: Trigger an initial analytics update on startup if needed
  // (Consider checking if the analytics document exists first)
});
