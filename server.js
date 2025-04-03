import foodRoutes from "./routes/foodRoutes.js";
import "dotenv/config";

import express from "express";
import mongoose from "mongoose";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

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
