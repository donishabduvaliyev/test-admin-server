/* --- routes/orders.js --- */
// Handles incoming requests to create new orders on the admin server

import express from 'express';
const router = express.Router();
import Order from '../modal/orderData.js'; // Adjust path to your Order model file
import axios from 'axios';

// Optional: Middleware for simple API Key Authentication
const requireApiKey = (req, res, next) => {
    const apiKey = req.get('X-API-Key'); // Get key from header (use the same header name as in bot server)
    const expectedApiKey = process.env.ADMIN_SERVER_API_KEY; // Get expected key from environment

    // Only enforce API key if it's set in the environment
    if (expectedApiKey && apiKey !== expectedApiKey) {
        console.warn(`⚠️ Unauthorized API access attempt. Provided key: ${apiKey}`);
        return res.status(401).json({ message: 'Unauthorized: Invalid API Key' });
    }
    // If no key is expected or the provided key is correct, proceed
    next();
};


const BOT_SERVER_NOTIFY_URL = process.env.BOT_SERVER_URL ? `${process.env.BOT_SERVER_URL}/api/notify` : 'http://localhost:5000/api/notify';
const ADMIN_API_KEY = process.env.ADMIN_SERVER_API_KEY; // API key to authenticate with the bot server

// --- Middleware for API Key Auth (if needed for admin routes) ---
// const requireApiKey = (req, res, next) => {
//     // ... (your existing API key middleware) ...
//     const apiKey = req.get('X-API-Key');
//     const expectedApiKey = process.env.ADMIN_SERVER_API_KEY;
//     if (expectedApiKey && apiKey !== expectedApiKey) {
//         return res.status(401).json({ message: 'Unauthorized: Invalid API Key' });
//     }
//     next();
// };


/**
 * POST /api/orders
 * Receives order data (presumably from the bot server) and saves it to the database.
 */router.post('/',  async (req, res, next) => { // Apply API key middleware if needed
    console.log("Received request to create order:", req.body);

    // 1. Basic Validation (Add more specific validation as needed)
    const requiredFields = ['user_id', 'delivery_type', 'products', 'total_price'];
    const missingFields = requiredFields.filter(field => !(field in req.body));

    if (missingFields.length > 0) {
        console.warn(`❌ Missing required fields: ${missingFields.join(', ')}`);
        return res.status(400).json({
            message: `Missing required order fields: ${missingFields.join(', ')}`
        });
    }

    if (!Array.isArray(req.body.products) || req.body.products.length === 0) {
        console.warn(`❌ Order must contain at least one product.`);
        return res.status(400).json({ message: 'Order must contain at least one product.' });
    }

    try {
        // 2. Create a new Order document instance using data from the request body
        const newOrder = new Order({
            user_id: req.body.user_id,
            customer_name: req.body.customer_name, // Optional field
            delivery_type: req.body.delivery_type,
            location_name: req.body.location_name, // Optional field
            products: req.body.products, // Ensure structure matches schema
            total_price: req.body.total_price,
            delivery_distance: req.body.delivery_distance || 0, // Default to 0 if not provided
            // Add any other fields from req.body that match your schema
            // customer_phone: req.body.customer_phone, 
            // comment: req.body.comment,
            // 'createdAt' and 'updatedAt' are handled by timestamps: true
        });

        // 3. Save the new order document to MongoDB
        const savedOrder = await newOrder.save();

        console.log(`✅ Order saved successfully. DB Order ID: ${savedOrder._id}`);

        // 4. Respond with success status (201 Created) and the saved order data
        // The bot server expects a response format like { order: {...} } based on previous code
        res.status(201).json({
            success: true,
            message: 'Order created successfully.',
            order: savedOrder // Send the complete saved order object back
        });

        // 5. Optional: Trigger other actions after saving (e.g., notify kitchen, update analytics immediately)
        // Be mindful of keeping the API response fast. Long tasks should be handled asynchronously.
        // Example: triggerKitchenNotification(savedOrder);
        // Example: updateDashboardAnalyticsDocument(); // If analytics logic is also on this server

    } catch (error) {
        console.error("❌ Error saving order:", error);

        // Handle Mongoose validation errors specifically
        if (error.name === 'ValidationError') {
            // Extract meaningful error messages
            const errors = Object.values(error.errors).map(el => el.message);
            return res.status(400).json({
                message: 'Validation Error',
                errors: errors
            });
        }

        // Pass other types of errors (e.g., database connection) to the global error handler
        next(error);
    }
});




router.put('/:orderId/status', async (req, res, next) => {
    const { orderId } = req.params;
    const { status } = req.body; // e.g., 'accepted', 'denied', 'ready', 'completed'

    // 1. Validate Status
    if (!status) {
        return res.status(400).json({ message: 'Missing status field in request body.' });
    }
    const allowedStatuses = ['accepted', 'denied', 'ready', 'completed', 'pending', 'cancelled']; // Add all valid statuses
    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ message: `Invalid status value: ${status}` });
    }

    console.log(`Received request to update order ${orderId} status to '${status}'`);

    try {
        // 2. Update Order Status in Database
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { $set: { order_status: status } }, // Ensure you have 'order_status' field in schema
            { new: true, runValidators: true }
        );

        if (!updatedOrder) {
            console.warn(`Order ${orderId} not found for status update.`);
            return res.status(404).json({ message: `Order with ID ${orderId} not found.` });
        }

        console.log(`✅ Order ${orderId} status updated to: ${status} in DB.`);

        // --- 3. Send Notification to Customer (via Bot Server) ---
        const customerChatId = updatedOrder.user_id; // Get customer's chat ID from the order
        let customerMessage = null;
        const orderShortId = `#${orderId.slice(-6)}`; // Short ID for messages

        switch (status) {
            case 'accepted':
                customerMessage = `✅ Sizning ${orderShortId} buyurtmangiz qabul qilindi! Tayyor bo'lganda xabar beramiz.`;
                break;
            case 'denied':
                customerMessage = `❌ Uzr, sizning ${orderShortId} buyurtmangiz rad etildi. Sababini bilish uchun operator bilan bog'laning.`;
                break;
            case 'ready':
                customerMessage = `✅ Sizning ${orderShortId} buyurtmangiz tayyor! Yetkazib berish/olib ketish uchun tez orada siz bilan bog'lanamiz.`;
                break;
            case 'completed':
                // Notification for completion might be sent by the bot itself after the 'deliver' button
                // Or you can send a final confirmation here if needed.
                customerMessage = `✅ Sizning ${orderShortId} buyurtmangiz yakunlandi.`;
                // Consider sending the review request from here instead of the bot's callback?
                break;
            // Add cases for other statuses if needed ('pending', 'cancelled')
        }

        // If a message was constructed, send it via the bot server
        if (customerMessage) {
            await notifyCustomerViaBot(customerChatId, customerMessage);
        }
        // --- End Notification ---

        // 4. Respond to the original request (from the bot server's callback handler)
        res.status(200).json({
            success: true,
            message: `Order status updated to ${status}`,
            order: updatedOrder
        });

    } catch (error) {
        console.error(`❌ Error updating status for order ${orderId}:`, error);
        if (error.name === 'CastError') {
            return res.status(400).json({ message: `Invalid Order ID format: ${orderId}` });
        }
        next(error); // Pass to global error handler
    }
});


/**
 * Sends a notification request to the bot server's /api/notify endpoint.
 * @param {string} chatId - The Telegram chat ID of the customer.
 * @param {string} message - The message to send.
 */
async function notifyCustomerViaBot(chatId, message) {
    if (!BOT_SERVER_NOTIFY_URL) {
        console.warn("⚠️ BOT_SERVER_NOTIFY_URL not set. Skipping notification.");
        return;
    }
    if (!chatId) {
        console.warn("⚠️ Cannot send notification: chatId is missing.");
        return;
    }

    console.log(`📤 Attempting to send notification to bot server for chatId ${chatId}`);
    try {
        const axiosConfig = {
            headers: { 'Content-Type': 'application/json' }
        };
        if (ADMIN_API_KEY) {
            axiosConfig.headers['X-API-Key'] = ADMIN_API_KEY; // Use the same key bot server expects
        }

        await axios.post(BOT_SERVER_NOTIFY_URL, { chatId, message }, axiosConfig);
        console.log(`✅ Notification request sent successfully for chatId ${chatId}.`);

    } catch (error) {
        // Log the error but don't fail the main admin server operation
        console.error(`❌ Error sending notification request to bot server for chatId ${chatId}:`, error.response?.data || error.message);
        // You could potentially queue this for retry later if notifications are critical
    }
}

router.put('/:orderId/review',async (req, res, next) => {
    const { orderId } = req.params;
    const { rating } = req.body; // Get rating from request body

    // 1. Validate Input
    if (rating === undefined || rating === null) {
        return res.status(400).json({ message: 'Missing rating field in request body.' });
    }
    const ratingNumber = Number(rating); // Ensure it's a number
    if (isNaN(ratingNumber) || ratingNumber < 1 || ratingNumber > 5) { // Validate range (1-5 stars)
        return res.status(400).json({ message: 'Invalid rating value. Must be a number between 1 and 5.' });
    }

    console.log(`Received request to update rating for order ${orderId} to ${ratingNumber}`);

    try {
        // 2. Find the order and update its rating field
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            {
                $set: { rating: ratingNumber } // Update only the rating field
            },
            {
                new: true, // Return the updated document
                runValidators: true // Ensure schema validation (min/max) runs
            }
        );

        // 3. Handle Not Found
        if (!updatedOrder) {
            console.warn(`Order ${orderId} not found for rating update.`);
            return res.status(404).json({ message: `Order with ID ${orderId} not found.` });
        }

        console.log(`✅ Order ${orderId} rating successfully updated to: ${ratingNumber}`);

        // 4. Respond with Success
        res.status(200).json({
            success: true,
            message: `Order rating updated to ${ratingNumber}`,
            order: updatedOrder // Return the updated order document
        });

        // Optional: Trigger further actions if needed (e.g., update average rating stats)
        // updateOverallRestaurantRating(ratingNumber);

    } catch (error) {
        console.error(`❌ Error updating rating for order ${orderId}:`, error);
        if (error.name === 'CastError') { // Handle invalid MongoDB ObjectId format
            return res.status(400).json({ message: `Invalid Order ID format: ${orderId}` });
        }
        // Pass other errors (DB connection, etc.) to the global error handler
        next(error);
    }
});





// --- Configuration ---
// URL of your BOT server's notification endpoint

// --- Helper Function to Call Bot Server ---

// --- Existing POST / route ---
// router.post('/', requireApiKey, async (req, res, next) => { /* ... */ });

// --- Existing PUT /:orderId/review route ---
// router.put('/:orderId/review', requireApiKey, async (req, res, next) => { /* ... */ });


// --- UPDATED Route to update order status ---
/**
 * PUT /api/orders/:orderId/status
 * Updates the status of an order and notifies the customer via the bot server.
 */


export default router;

