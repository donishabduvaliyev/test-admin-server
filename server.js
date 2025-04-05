import foodRoutes from "./routes/foodRoutes.js";
import "dotenv/config";

import express from "express";
import mongoose from "mongoose";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// const allowedOrigins = [
//   "http://localhost:5174",
//   "http://localhost:5173",
//   " https://test-bot-admin.netlify.app ",
//   "https://web.telegram.org",
//   "https://localhost:5000"
// ];

// app.use(cors({
//   origin: function (origin, callback) {
//     if (!origin || allowedOrigins.includes(origin) ) {
//       callback(null, true);
//     } else {
//       callback(new Error("Not allowed by CORS"));
//     }
//   },
//   methods: "GET,POST",
//   allowedHeaders: "Content-Type",
//   credentials: true
// }));

// const cors = require("cors");

app.use(cors({
  origin: "https://test-bot-admin.netlify.app", // <- your frontend domain
  credentials: true
}));


// ✅ Connect to MongoDB only ONCE
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

mongoose.set("debug", true); // Enable query debugging

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
