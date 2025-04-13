import foodRoutes from "./routes/foodRoutes.js";
import "dotenv/config";

import express from "express";
import mongoose from "mongoose";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const allowedOrigins = [
  "http://localhost:5174",
  "http://localhost:5173",
  "https://test-bot-admin.netlify.app", // Removed spaces around the URL
  "https://web.telegram.org",
  "http://localhost:5000" // Changed to http (typical for localhost)
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `CORS policy blocks this origin: ${origin}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: "Content-Type, ",
  // credentials: true
}));

// ✅ Connect to MongoDB only ONCE
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

mongoose.set("debug", true);

app.get("/", (req, res) => {
  res.send("✅ Server is running!");
});

// ✅ Load Routes
app.use("/api/food", foodRoutes);

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});