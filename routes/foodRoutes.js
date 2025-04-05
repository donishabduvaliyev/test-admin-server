import { Router } from "express";
import Food from "../modal/modal.js";
import multer from "multer";
import cloudinary from "../cloudinaryconfig.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import Admin from "../modal/admin.js";
import ScheduleModel from "../modal/botModal.js";
import axios from "axios";
import { verifyToken } from "../middleware/auth.js";

const TELEGRAM_BACKEND_URL = process.env.TELEGRAM_BACKEND_URL; // Replace with your bot backend URL
const SECRET_KEY = process.env.SECRET_KEY;


const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});
const JWT_SECRET = process.env.JWT_SECRET;


async function checkAdmin() {
  const admin = await Admin.findOne({ username: "admin" });
  console.log(admin);
}
checkAdmin();
/**
 * @route GET /api/food
 * @desc Get all food items
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const foods = await Food.find();
    res.json({
      message: "Welcome to Admin Dashboard",
      admin: req.admin,
      foods, // Send food data inside the same response
    });

  } catch (error) {
    res.status(500).json({ message: "❌ Server Error", error: error.message });
  }
});




/**
 * @route POST /api/food/add
 * @desc Add new food item with image upload
 */


router.post("/add", async (req, res) => {
  try {
    // const { name, price, category, sizes, toppings, isAviable, image } = req.body;


    console.log("yangi mahsulot", req.body);


    const { name, price, category, sizes, toppings, image, isAvailable } = req.body;

    if (!name || !price || !category || !image) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newItem = {
      name,
      price,
      category,
      image,
      isAvailable: isAvailable === true, // Ensure Boolean
      sizes: Array.isArray(sizes) ? sizes : [],
      toppings: Array.isArray(toppings) ? toppings : [],
    };

    // Find the first (or only) document in `productData`
    let foodDocument = await Food.findOne();

    // If no document exists, create one
    if (!foodDocument) {
      foodDocument = new Food({ categories: [], items: [newItem] });
    } else {
      // Add new item to `items` array
      foodDocument.items.push(newItem);
    }

    await foodDocument.save();
    res.status(201).json({ message: "Food item added successfully", newItem });


  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Update food item
router.put("/:foodId", upload.single("image"), async (req, res) => {
  try {
    const { foodId } = req.params;

    // ✅ Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(foodId)) {
      return res.status(400).json({ message: "❌ Invalid food ID format" });
    }

    const foodDocs = await Food.find();



    let foodDoc = null;
    let foodItem = null;

    for (const doc of foodDocs) {
      foodItem = doc.items.find(item => item._id.toString() === foodId);
      if (foodItem) {
        foodDoc = doc;
        break;
      }
    }
    if (!foodDoc) {
      return res.status(404).json({ message: "❌ Food document not found in database" });
    }
    if (!foodItem) {
      return res.status(404).json({ message: "❌ Food item not found inside items array" });
    }
    if (!foodDoc) {
      return res.status(404).json({ message: "❌ Food item not found in database" });
    }
    if (!foodItem) {
      return res.status(404).json({ message: "❌ Food item not found inside items array" });
    }
    // ✅ Update fields if provided in request
    foodItem.name = req.body.name || foodItem.name;
    console.log("frontdan kelgan malumot", req.body);

    foodItem.price = req.body.price || foodItem.price;
    foodItem.category = req.body.category || foodItem.category;
    foodItem.image = req.body.image || foodItem.image
    foodItem.isAviable = req.body.isAviable || foodItem.isAviable

    if (typeof req.body.isAviable !== "undefined") {
      foodItem.isAviable = req.body.isAviable;
    }

    // foodItem.toppings = req.body.toppings ? JSON.parse(req.body.toppings) : foodItem.toppings;
    if (req.body.toppings) {
      try {
        foodItem.toppings = Array.isArray(req.body.toppings)
          ? req.body.toppings
          : JSON.parse(req.body.toppings);
      } catch (error) {
        return res.status(400).json({ message: "❌ Invalid JSON format for toppings" });
      }
    }
    if (req.body.sizes === "") {
      req.body.sizes = [];
    } else if (typeof req.body.sizes === "string") {
      try {
        req.body.sizes = JSON.parse(req.body.sizes);
      } catch (error) {
        return res.status(400).json({ message: "Invalid JSON format for sizes" });
      }
    }

    foodItem.sizes = req.body.sizes

    // foodDoc.items = foodDoc.items.map(item => {
    //   if (typeof item.sizes === "string") {
    //     // If sizes is an empty string, replace it with an empty array.
    //     return { ...item, sizes: [] };
    //   }
    //   return item;
    // });



    // ✅ Save the updated document
    await foodDoc.save();
    // await foodDoc.save();
    res.json({ message: "✅ Food updated successfully", food: foodItem });
    // console.log("✅ Updated food document:", await Food.findById(foodDoc._id));
  } catch (error) {
    console.error("❌ Error updating food:", error);
    res.status(500).json({ message: "❌ Internal server error" });
  }
});

router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image provided" });
    }

    // Convert buffer to base64 for Cloudinary upload
    const fileBuffer = `data:image/png;base64,${req.file.buffer.toString("base64")}`;

    // Upload image to Cloudinary
    const result = await cloudinary.uploader.upload(fileBuffer, {
      folder: "restaurant_foods", // Change folder name if needed
    });

    res.json({ image: result.secure_url });


  } catch (error) {
    console.error("Cloudinary upload failed:", error);
    res.status(500).json({ message: "Cloudinary upload failed", error: error.message });
  }
});


router.post(
  "/login",
  [body("username").notEmpty(), body("password").notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, password } = req.body;
    try {
      const admin = await Admin.findOne({ username });
      console.log("admin db", admin);
      console.log("front end", password);
      console.log("db pasword", admin.password);



      if (!admin) return res.status(401).json({ message: "Invalid Credentials" });

      if (admin.password !== password) {
        return res.status(401).json({ message: "Invalid Credentials" });
      }


      const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET || "default_secret", { expiresIn: "1h" });
      res.json({ token });
      console.log("succesfully logged in");
      
    } catch (error) {
      res.status(500).json({ message: "Server Error", error: error.message });
    }
  }
);


// Protect Routes Middleware


// ✅ Update Admin Credentials (Username or Password)
router.put("/updateAdmin", async (req, res) => {
  try {
    if (!req.admin || !req.admin.id) {
      return res.status(401).json({ message: "Unauthorized request" });
    }
    const adminId = req.admin.id;
    const { username, password } = req.body;

    let admin = await Admin.findById(adminId);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    if (username) {
      admin.username = username;
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      admin.password = await bcrypt.hash(password, salt);
    }

    await admin.save();
    res.json({ message: "Credentials updated successfully!" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// GEt Bot shudle
router.get("/bot-schedule", async (req, res) => {
  try {
    const schedule = await ScheduleModel.findOne();
    if (!schedule) return res.status(404).json({ message: "Schedule not found" });
    res.json(schedule);
  } catch (error) {
    console.error("❌ Error fetching schedule:", error); // 🔍 Log the full error
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


// Update bot schedule
router.post("/bot-schedule/update", async (req, res) => {
  try {
    const { schedule, isEmergencyOff } = req.body;
    let botSchedule = await ScheduleModel.findOne();
    if (!botSchedule) {
      botSchedule = new ScheduleModel({ schedule, isEmergencyOff });
    } else {
      botSchedule.schedule = schedule;
      botSchedule.isEmergencyOff = isEmergencyOff;
    }
    await botSchedule.save();
    res.json({ message: "Schedule updated successfully!" });
  } catch (error) {
    console.error("❌ Error updating schedule:", error); // 🔍 Log the full error
    res.status(500).json({ message: "Failed to update schedule", error: error.message });
  }
});



/**
 * @route POST /api/food/send-broadcast
 * @desc Send a broadcast message with an image to all bot users
 */
router.post("/send-broadcast", async (req, res) => {
  try {
    const { title, message, imageUrl } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: "❌ Title, message, and image URL are required!" });
    }

    if (!TELEGRAM_BACKEND_URL) {
      return res.status(500).json({ message: "❌ Bot backend URL is not configured!" });
    }

    const response = await axios.post(TELEGRAM_BACKEND_URL, {
      title,
      message,
      imageUrl,
      secretKey: SECRET_KEY
    });

    if (response.status !== 200) {
      return res.status(500).json({ message: "❌ Failed to send broadcast", error: response.data });
    }
    console.log(response);

    res.json({ message: "✅ Broadcast message sent successfully!", response: response.data });

  } catch (error) {
    console.error("❌ Broadcast Error:", error.response?.data || error.message);
    res.status(500).json({ message: "❌ Failed to send broadcast", error: error.message });
  }
});



export default router;
