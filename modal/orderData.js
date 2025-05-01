/* --- models/Order.js (Admin Server) --- */
// Represents the raw data for each individual order

import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    // --- Existing fields ---
    user_id: { type: String, required: true, index: true }, 
    customer_name: String, 
    delivery_type: { 
        type: String, 
        enum: ["delivery", "takeout"], 
        required: true,
        index: true 
    }, 
    location_name: String, 
    products: [
      {
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 }, 
        _id: false 
      },
    ],
    total_price: { type: Number, required: true, min: 0 }, 
    delivery_distance: { type: Number, default: 0, min: 0 }, 
    order_status: { // Assuming you added this for status updates
        type: String,
        enum: ['pending', 'accepted', 'denied', 'ready', 'completed', 'delivered'], // Example statuses
        default: 'pending', 
        index: true
    },
    
  
    rating: {
        type: Number,
        min: 0, // Use 0 to indicate 'not rated yet'
        max: 5, // Assuming a 1-5 star rating system
        default: 0, // Default to not rated
        index: true // Index if you plan to query orders by rating often
    }
    
  },
  { 
    // Automatically add createdAt and updatedAt fields
    timestamps: true 
  } 
);

// Add pre-save hook or validation if needed, e.g., ensure rating is integer

const Order = mongoose.model("Order", orderSchema , "orderData"); 
export default Order;
