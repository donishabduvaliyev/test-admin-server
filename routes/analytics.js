/* --- routes/analytics.js --- */
// Handles calculation, update, and retrieval of global dashboard analytics

import { Router } from "express";
const router = Router();
import Order from "../modal/orderData"; // Use the updated Order model
import { findOneAndUpdate, findOne } from "../modal/dashboardData"; // Use the new analytics model

// Define the timezone for date calculations (consistent with your restaurant's location)
const TIMEZONE = "Asia/Tashkent";

/**
 * Calculates global dashboard analytics by aggregating data from the Orders collection.
 * @returns {Promise<object|null>} The calculated analytics data or null on error.
 */
async function calculateGlobalAnalytics() {
    try {
        const now = new Date();

        // --- Define Time Ranges (Using UTC for range boundaries is generally safer) ---
        // Today
        const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

        // This Week (ISO 8601 week starts on Monday)
        const currentDayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        const diffToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek; // Days to subtract to get to Monday
        const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMonday, 0, 0, 0, 0));
        const weekEnd = new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + 6, 23, 59, 59, 999)); // Monday + 6 days

        // This Month
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
        const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)); // Day 0 of next month = last day of current

        // This Year
        const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
        const yearEnd = new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59, 999));

        // --- Aggregation Pipeline using $facet ---
        const results = await Order.aggregate([
            { // No initial $match needed, aggregate across all orders
                $facet: {
                    // --- Today's Data ---
                    todayStats: [
                        { $match: { createdAt: { $gte: todayStart, $lte: todayEnd } } },
                        {
                            $group: {
                                _id: null, // Group all today's orders
                                orders: { $sum: 1 },
                                price: { $sum: "$total_price" },
                                deliveryOrders: { $sum: { $cond: [{ $eq: ["$delivery_type", "delivery"] }, 1, 0] } },
                                deliveryPrice: { $sum: { $cond: [{ $eq: ["$delivery_type", "delivery"] }, "$total_price", 0] } },
                                deliveryDistance: { $sum: { $cond: [{ $eq: ["$delivery_type", "delivery"] }, "$delivery_distance", 0] } },
                                uniqueUserIds: { $addToSet: "$user_id" } // Collect unique user IDs
                            }
                        },
                        {
                            $project: { // Reshape the output
                                _id: 0, // Exclude the default _id
                                orders: 1, price: 1, deliveryOrders: 1, deliveryPrice: 1, deliveryDistance: 1,
                                users: { $size: "$uniqueUserIds" } // Count unique users
                            }
                        }
                    ],
                    todayChart: [ // Chart data grouped by hour (using specified timezone)
                        { $match: { createdAt: { $gte: todayStart, $lte: todayEnd } } },
                        {
                            $group: {
                                // Group by the hour number in the specified timezone
                                _id: { $hour: { date: "$createdAt", timezone: TIMEZONE } },
                                total: { $sum: "$total_price" } // Sum prices for orders in that hour
                            }
                        },
                        { $sort: { "_id": 1 } }, // Sort by hour (0-23)
                        // Format the output for the chart schema
                        { $project: { _id: 0, date: { $concat: [{ $toString: "$_id" }, ":00"] }, total: 1 } }
                    ],

                    // --- Week's Data ---
                    weekStats: [
                        { $match: { createdAt: { $gte: weekStart, $lte: weekEnd } } },
                        {
                            $group: {
                                _id: null,
                                orders: { $sum: 1 },
                                price: { $sum: "$total_price" },
                                deliveryOrders: { $sum: { $cond: [{ $eq: ["$delivery_type", "delivery"] }, 1, 0] } },
                                deliveryPrice: { $sum: { $cond: [{ $eq: ["$delivery_type", "delivery"] }, "$total_price", 0] } },
                                deliveryDistance: { $sum: { $cond: [{ $eq: ["$delivery_type", "delivery"] }, "$delivery_distance", 0] } },
                                uniqueUserIds: { $addToSet: "$user_id" }
                            }
                        },
                        { $project: { _id: 0, orders: 1, price: 1, deliveryOrders: 1, deliveryPrice: 1, deliveryDistance: 1, users: { $size: "$uniqueUserIds" } } }
                    ],
                    weekChart: [ // Chart data grouped by day of week (using specified timezone)
                        { $match: { createdAt: { $gte: weekStart, $lte: weekEnd } } },
                        {
                            $group: {
                                // Group by day of week number (1=Sun...7=Sat in MongoDB) in the specified timezone
                                _id: { $dayOfWeek: { date: "$createdAt", timezone: TIMEZONE } },
                                total: { $sum: "$total_price" } // Sum prices for orders on that day
                            }
                        },
                        { $sort: { "_id": 1 } }, // Sort by day number
                        {
                            $project: {
                                _id: 0,
                                // Map day number to abbreviation
                                date: {
                                    $switch: {
                                        branches: [
                                            { case: { $eq: ["$_id", 1] }, then: "Sun" },
                                            { case: { $eq: ["$_id", 2] }, then: "Mon" },
                                            { case: { $eq: ["$_id", 3] }, then: "Tue" },
                                            { case: { $eq: ["$_id", 4] }, then: "Wed" },
                                            { case: { $eq: ["$_id", 5] }, then: "Thu" },
                                            { case: { $eq: ["$_id", 6] }, then: "Fri" },
                                            { case: { $eq: ["$_id", 7] }, then: "Sat" }
                                        ],
                                        default: "Unk" // Fallback
                                    }
                                },
                                total: 1
                            }
                        }
                    ],

                    // --- Month's Data ---
                    monthStats: [
                        { $match: { createdAt: { $gte: monthStart, $lte: monthEnd } } },
                        {
                            $group: {
                                _id: null,
                                orders: { $sum: 1 },
                                price: { $sum: "$total_price" },
                                deliveryOrders: { $sum: { $cond: [{ $eq: ["$delivery_type", "delivery"] }, 1, 0] } },
                                deliveryPrice: { $sum: { $cond: [{ $eq: ["$delivery_type", "delivery"] }, "$total_price", 0] } },
                                deliveryDistance: { $sum: { $cond: [{ $eq: ["$delivery_type", "delivery"] }, "$delivery_distance", 0] } },
                                uniqueUserIds: { $addToSet: "$user_id" }
                            }
                        },
                        { $project: { _id: 0, orders: 1, price: 1, deliveryOrders: 1, deliveryPrice: 1, deliveryDistance: 1, users: { $size: "$uniqueUserIds" } } }
                    ],
                    monthChart: [ // Chart data grouped by week of month (using specified timezone)
                        { $match: { createdAt: { $gte: monthStart, $lte: monthEnd } } },
                        {
                            $group: {
                                // Group by ISO week number in the specified timezone
                                _id: { $isoWeek: { date: "$createdAt", timezone: TIMEZONE } },
                                total: { $sum: "$total_price" }, // Sum prices for orders in that week
                                // Keep the first date of the week for sorting/labeling
                                weekStartDate: { $min: "$createdAt" }
                            }
                        },
                        { $sort: { "weekStartDate": 1 } }, // Sort by the actual start date of the week
                        // Calculate relative week number within the month
                        {
                            $set: {
                                monthStartWeek: { $isoWeek: { date: monthStart, timezone: TIMEZONE } }
                            }
                        },
                        {
                            $project: {
                                _id: 0,
                                // Calculate week number relative to the start of the month
                                date: { $concat: ["Week ", { $toString: { $add: [{ $subtract: ["$_id", "$monthStartWeek"] }, 1] } }] },
                                total: 1
                            }
                        }
                    ],

                    // --- Year's Data ---
                    yearStats: [
                        { $match: { createdAt: { $gte: yearStart, $lte: yearEnd } } },
                        {
                            $group: {
                                _id: null,
                                orders: { $sum: 1 },
                                price: { $sum: "$total_price" },
                                deliveryOrders: { $sum: { $cond: [{ $eq: ["$delivery_type", "delivery"] }, 1, 0] } },
                                deliveryPrice: { $sum: { $cond: [{ $eq: ["$delivery_type", "delivery"] }, "$total_price", 0] } },
                                deliveryDistance: { $sum: { $cond: [{ $eq: ["$delivery_type", "delivery"] }, "$delivery_distance", 0] } },
                                uniqueUserIds: { $addToSet: "$user_id" }
                            }
                        },
                        { $project: { _id: 0, orders: 1, price: 1, deliveryOrders: 1, deliveryPrice: 1, deliveryDistance: 1, users: { $size: "$uniqueUserIds" } } }
                    ],
                    yearChart: [ // Chart data grouped by month (using specified timezone)
                        { $match: { createdAt: { $gte: yearStart, $lte: yearEnd } } },
                        {
                            $group: {
                                // Group by month number (1-12) in the specified timezone
                                _id: { $month: { date: "$createdAt", timezone: TIMEZONE } },
                                total: { $sum: "$total_price" } // Sum prices for orders in that month
                            }
                        },
                        { $sort: { "_id": 1 } }, // Sort by month number
                        {
                            $project: {
                                _id: 0,
                                // Map month number to abbreviation
                                date: {
                                    $switch: {
                                        branches: [
                                            { case: { $eq: ["$_id", 1] }, then: "Jan" }, { case: { $eq: ["$_id", 2] }, then: "Feb" },
                                            { case: { $eq: ["$_id", 3] }, then: "Mar" }, { case: { $eq: ["$_id", 4] }, then: "Apr" },
                                            { case: { $eq: ["$_id", 5] }, then: "May" }, { case: { $eq: ["$_id", 6] }, then: "Jun" },
                                            { case: { $eq: ["$_id", 7] }, then: "Jul" }, { case: { $eq: ["$_id", 8] }, then: "Aug" },
                                            { case: { $eq: ["$_id", 9] }, then: "Sep" }, { case: { $eq: ["$_id", 10] }, then: "Oct" },
                                            { case: { $eq: ["$_id", 11] }, then: "Nov" }, { case: { $eq: ["$_id", 12] }, then: "Dec" }
                                        ],
                                        default: "Unk"
                                    }
                                },
                                total: 1
                            }
                        }
                    ]
                }
            }
        ]);

        // --- Format the results into the DashboardAnalytics schema structure ---
        // $facet returns an array. Access the first element results[0].
        // If a facet has no matching documents, its array will be empty. Use || {} or || [] as fallback.
        const analyticsData = {
            today: { ...(results[0].todayStats[0] || {}), chart: results[0].todayChart || [] },
            week: { ...(results[0].weekStats[0] || {}), chart: results[0].weekChart || [] },
            month: { ...(results[0].monthStats[0] || {}), chart: results[0].monthChart || [] },
            year: { ...(results[0].yearStats[0] || {}), chart: results[0].yearChart || [] }
        };

        return analyticsData;

    } catch (error) {
        console.error("Error calculating global analytics:", error);
        return null; // Indicate failure
    }
}

/**
 * Updates the single global dashboard analytics document in the database.
 */
async function updateDashboardAnalyticsDocument() {
    console.log(`[${new Date().toISOString()}] Attempting to update global dashboard analytics...`);
    const calculatedData = await calculateGlobalAnalytics();

    if (!calculatedData) {
        console.error("Analytics calculation failed. Update aborted.");
        return false; // Indicate failure
    }

    try {
        const updatedDoc = await findOneAndUpdate(
            { identifier: 'main_dashboard' }, // Find the document by its unique identifier
            { $set: calculatedData }, // Set the fields to the newly calculated data
            {
                upsert: true, // Create the document if it doesn't exist
                new: true, // Return the modified document
                runValidators: true // Ensure the update respects schema validation
            }
        );
        console.log(`Global dashboard analytics updated successfully at: ${updatedDoc.updatedAt}`);
        return true; // Indicate success
    } catch (error) {
        console.error("Error updating dashboard analytics document:", error);
        return false; // Indicate failure
    }
}


// --- API Routes ---

/**
 * POST /api/analytics/update
 * Manually triggers the update of the global dashboard analytics document.
 */
router.post("/updateAnalytics", async (req, res, next) => {
    try {
        const success = await updateDashboardAnalyticsDocument(); // Call the update function
        if (success) {
            res.status(200).json({ message: 'Global dashboard analytics update process finished successfully.' });
        } else {
            res.status(500).json({ message: 'Global dashboard analytics update process failed during calculation or saving.' });
        }
    } catch (error) {
        // Catch unexpected errors during the request handling itself
        console.error("Error in /api/analytics/update route:", error);
        next(error); // Pass to global error handler
    }
});

/**
 * GET /api/analytics/dashboard
 * Retrieves the latest global dashboard analytics data.
 */
router.get("/dashboardAnalytics", async (req, res, next) => {
    try {
        // Find the single document using the fixed identifier
        const analytics = await findOne({ identifier: 'main_dashboard' });

        if (!analytics) {
            // If not found, it might not have been created/updated yet
            return res.status(404).json({ message: 'Global analytics data not found. Run the update process first.' });
        }
        // Send the found document
        res.status(200).json(analytics);
    } catch (err) {
        console.error("Error fetching global dashboard data:", err);
        next(err); // Pass to global error handler
    }
});

export default { router, updateDashboardAnalyticsDocument }; // Export router and the update function for cron
