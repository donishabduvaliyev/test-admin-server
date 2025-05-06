/* --- routes/analytics.js --- */
// Handles calculation, update, and retrieval of global dashboard analytics

import { Router } from "express";
const router = Router();
import Order from "../modal/orderData.js"; // Ensure this path is correct
import DashboardAnalytics from "../modal/dashboardData.js"; // Ensure this path is correct

// Define the timezone for date calculations (consistent with your restaurant's location)
const TIMEZONE = "Asia/Tashkent"; // Make sure this is the correct Olson timezone identifier

/**
 * Calculates global dashboard analytics by aggregating data from the Orders collection.
 * @returns {Promise<object|null>} The calculated analytics data or null on error.
 */
async function calculateGlobalAnalytics() {
    console.log("[Analytics] Starting calculateGlobalAnalytics..."); // DEBUG LOG
    try {
        const now = new Date();

        // --- Define Time Ranges (Using UTC for range boundaries is generally safer) ---
        // Today
        const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

        // This Week (ISO 8601 week starts on Monday)
        const currentDayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
        const diffToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
        const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMonday, 0, 0, 0, 0));
        const weekEnd = new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + 6, 23, 59, 59, 999));

        // This Month
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
        const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

        // This Year
        const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
        const yearEnd = new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59, 999));

        console.log("[Analytics] Time ranges defined:", { todayStart, todayEnd, weekStart, weekEnd, monthStart, monthEnd, yearStart, yearEnd }); // DEBUG LOG

        // --- Aggregation Pipeline using $facet ---
        const results = await Order.aggregate([
            {
                $facet: {
                    // --- Today's Data ---
                    todayStats: [
                        { $match: { createdAt: { $gte: todayStart, $lte: todayEnd } } },
                        {
                            $group: {
                                _id: null,
                                orders: { $sum: 1 },
                                price: { $sum: "$total_price" }, // Ensure total_price is a Number in Order documents
                                deliveryOrders: { $sum: { $cond: [{ $eq: ["$delivery_type", "delivery"] }, 1, 0] } },
                                deliveryPrice: { $sum: { $cond: [{ $eq: ["$delivery_type", "delivery"] }, "$total_price", 0] } },
                                deliveryDistance: { $sum: { $cond: [{ $eq: ["$delivery_type", "delivery"] }, "$delivery_distance", 0] } },
                                uniqueUserIds: { $addToSet: "$user_id" }
                            }
                        },
                        {
                            $project: {
                                _id: 0, orders: 1, price: 1, deliveryOrders: 1, deliveryPrice: 1, deliveryDistance: 1,
                                users: { $size: "$uniqueUserIds" }
                            }
                        }
                    ],
                    todayChart: [
                        { $match: { createdAt: { $gte: todayStart, $lte: todayEnd } } },
                        {
                            $group: {
                                _id: { $hour: { date: "$createdAt", timezone: TIMEZONE } },
                                total: { $sum: "$total_price" }
                            }
                        },
                        { $sort: { "_id": 1 } },
                        { $project: { _id: 0, date: { $concat: [{ $toString: "$_id" }, ":00"] }, total: 1 } }
                    ],
                    // --- Week's Data ---
                    weekStats: [
                        { $match: { createdAt: { $gte: weekStart, $lte: weekEnd } } },
                        {
                            $group: {
                                _id: null, orders: { $sum: 1 }, price: { $sum: "$total_price" },
                                deliveryOrders: { $sum: { $cond: [{ $eq: ["$delivery_type", "delivery"] }, 1, 0] } },
                                deliveryPrice: { $sum: { $cond: [{ $eq: ["$delivery_type", "delivery"] }, "$total_price", 0] } },
                                deliveryDistance: { $sum: { $cond: [{ $eq: ["$delivery_type", "delivery"] }, "$delivery_distance", 0] } },
                                uniqueUserIds: { $addToSet: "$user_id" }
                            }
                        },
                        { $project: { _id: 0, orders: 1, price: 1, deliveryOrders: 1, deliveryPrice: 1, deliveryDistance: 1, users: { $size: "$uniqueUserIds" } } }
                    ],
                    weekChart: [
                        { $match: { createdAt: { $gte: weekStart, $lte: weekEnd } } },
                        {
                            $group: {
                                _id: { $dayOfWeek: { date: "$createdAt", timezone: TIMEZONE } },
                                total: { $sum: "$total_price" }
                            }
                        },
                        { $sort: { "_id": 1 } },
                        {
                            $project: {
                                _id: 0,
                                date: {
                                    $switch: {
                                        branches: [
                                            { case: { $eq: ["$_id", 1] }, then: "Sun" }, { case: { $eq: ["$_id", 2] }, then: "Mon" },
                                            { case: { $eq: ["$_id", 3] }, then: "Tue" }, { case: { $eq: ["$_id", 4] }, then: "Wed" },
                                            { case: { $eq: ["$_id", 5] }, then: "Thu" }, { case: { $eq: ["$_id", 6] }, then: "Fri" },
                                            { case: { $eq: ["$_id", 7] }, then: "Sat" }
                                        ], default: "Unk"
                                    }
                                }, total: 1
                            }
                        }
                    ],
                    // --- Month's Data ---
                    monthStats: [
                        { $match: { createdAt: { $gte: monthStart, $lte: monthEnd } } },
                        {
                            $group: {
                                _id: null, orders: { $sum: 1 }, price: { $sum: "$total_price" },
                                deliveryOrders: { $sum: { $cond: [{ $eq: ["$delivery_type", "delivery"] }, 1, 0] } },
                                deliveryPrice: { $sum: { $cond: [{ $eq: ["$delivery_type", "delivery"] }, "$total_price", 0] } },
                                deliveryDistance: { $sum: { $cond: [{ $eq: ["$delivery_type", "delivery"] }, "$delivery_distance", 0] } },
                                uniqueUserIds: { $addToSet: "$user_id" }
                            }
                        },
                        { $project: { _id: 0, orders: 1, price: 1, deliveryOrders: 1, deliveryPrice: 1, deliveryDistance: 1, users: { $size: "$uniqueUserIds" } } }
                    ],
                    monthChart: [
                        { $match: { createdAt: { $gte: monthStart, $lte: monthEnd } } },
                        {
                            $group: {
                                _id: { $isoWeek: { date: "$createdAt", timezone: TIMEZONE } },
                                total: { $sum: "$total_price" },
                                weekStartDate: { $min: "$createdAt" }
                            }
                        },
                        { $sort: { "weekStartDate": 1 } },
                        { $set: { monthStartWeek: { $isoWeek: { date: monthStart, timezone: TIMEZONE } } } },
                        {
                            $project: {
                                _id: 0,
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
                                _id: null, orders: { $sum: 1 }, price: { $sum: "$total_price" },
                                deliveryOrders: { $sum: { $cond: [{ $eq: ["$delivery_type", "delivery"] }, 1, 0] } },
                                deliveryPrice: { $sum: { $cond: [{ $eq: ["$delivery_type", "delivery"] }, "$total_price", 0] } },
                                deliveryDistance: { $sum: { $cond: [{ $eq: ["$delivery_type", "delivery"] }, "$delivery_distance", 0] } },
                                uniqueUserIds: { $addToSet: "$user_id" }
                            }
                        },
                        { $project: { _id: 0, orders: 1, price: 1, deliveryOrders: 1, deliveryPrice: 1, deliveryDistance: 1, users: { $size: "$uniqueUserIds" } } }
                    ],
                    yearChart: [
                        { $match: { createdAt: { $gte: yearStart, $lte: yearEnd } } },
                        {
                            $group: {
                                _id: { $month: { date: "$createdAt", timezone: TIMEZONE } },
                                total: { $sum: "$total_price" }
                            }
                        },
                        { $sort: { "_id": 1 } },
                        {
                            $project: {
                                _id: 0,
                                date: {
                                    $switch: {
                                        branches: [
                                            { case: { $eq: ["$_id", 1] }, then: "Jan" }, { case: { $eq: ["$_id", 2] }, then: "Feb" },
                                            { case: { $eq: ["$_id", 3] }, then: "Mar" }, { case: { $eq: ["$_id", 4] }, then: "Apr" },
                                            { case: { $eq: ["$_id", 5] }, then: "May" }, { case: { $eq: ["$_id", 6] }, then: "Jun" },
                                            { case: { $eq: ["$_id", 7] }, then: "Jul" }, { case: { $eq: ["$_id", 8] }, then: "Aug" },
                                            { case: { $eq: ["$_id", 9] }, then: "Sep" }, { case: { $eq: ["$_id", 10] }, then: "Oct" },
                                            { case: { $eq: ["$_id", 11] }, then: "Nov" }, { case: { $eq: ["$_id", 12] }, then: "Dec" }
                                        ], default: "Unk"
                                    }
                                }, total: 1
                            }
                        }
                    ]
                }
            }
        ]);

        console.log("[Analytics] Raw aggregation results:", JSON.stringify(results, null, 2)); // DEBUG LOG

        if (!results || results.length === 0 || !results[0]) { // Added check for results[0]
            console.error("[Analytics] Aggregation returned no results, empty array, or results[0] is undefined.");
            return null;
        }

        // Ensure all facet outputs exist, even if empty, to prevent access errors
        const todayStats = results[0].todayStats && results[0].todayStats.length > 0 ? results[0].todayStats[0] : {};
        const todayChart = results[0].todayChart || [];
        const weekStats = results[0].weekStats && results[0].weekStats.length > 0 ? results[0].weekStats[0] : {};
        const weekChart = results[0].weekChart || [];
        const monthStats = results[0].monthStats && results[0].monthStats.length > 0 ? results[0].monthStats[0] : {};
        const monthChart = results[0].monthChart || [];
        const yearStats = results[0].yearStats && results[0].yearStats.length > 0 ? results[0].yearStats[0] : {};
        const yearChart = results[0].yearChart || [];


        const analyticsData = {
            today: { ...todayStats, chart: todayChart },
            week: { ...weekStats, chart: weekChart },
            month: { ...monthStats, chart: monthChart },
            year: { ...yearStats, chart: yearChart }
        };

        console.log("[Analytics] Formatted analyticsData to be returned:", JSON.stringify(analyticsData, null, 2)); // DEBUG LOG
        return analyticsData;

    } catch (error) {
        console.error("[Analytics] CRITICAL Error in calculateGlobalAnalytics:", error); // Modified Log for emphasis
        return null;
    }
}

/**
 * Updates the single global dashboard analytics document in the database.
 */
async function updateDashboardAnalyticsDocument() {
    console.log(`[Analytics Update] Attempting to update global dashboard analytics at ${new Date().toISOString()}...`); // DEBUG LOG
    const calculatedData = await calculateGlobalAnalytics();

    if (!calculatedData) {
        console.error("[Analytics Update] Analytics calculation returned null. Update aborted."); // DEBUG LOG
        return false;
    }
    console.log("[Analytics Update] Successfully calculated data. Proceeding to save."); // DEBUG LOG
    // console.log("[Analytics Update] Data to be saved:", JSON.stringify(calculatedData, null, 2)); // Already logged in calculateGlobalAnalytics

    try {
        const updatedDoc = await DashboardAnalytics.findOneAndUpdate(
            { identifier: 'main_dashboard' },
            { $set: calculatedData },
            {
                upsert: true,
                new: true,
                runValidators: true
            }
        );
        // Check if updatedDoc is null, which can happen if findOneAndUpdate fails silently with some configurations (though less likely with upsert:true)
        if (!updatedDoc) {
            console.error("[Analytics Update] findOneAndUpdate returned null or undefined, even with upsert. This is unexpected.");
            return false;
        }
        console.log(`[Analytics Update] Global dashboard analytics updated successfully. Document ID: ${updatedDoc._id}, Updated At: ${updatedDoc.updatedAt}`); // DEBUG LOG
        return true;
    } catch (error) {
        console.error("[Analytics Update] CRITICAL Error updating dashboard analytics document in DB:", error); // Modified Log for emphasis
        return false;
    }
}


// --- API Routes ---

/**
 * POST /api/analytics/updateAnalytics (Corrected route name from /update to /updateAnalytics to match common practice)
 * Manually triggers the update of the global dashboard analytics document.
 */
router.post("/updateAnalytics", async (req, res, next) => {
    console.log(`[API Call] Received POST request to /api/analytics/updateAnalytics at ${new Date().toISOString()}`); // DEBUG LOG
    try {
        const success = await updateDashboardAnalyticsDocument();
        if (success) {
            console.log("[API Call] /api/analytics/updateAnalytics finished successfully."); // DEBUG LOG
            res.status(200).json({ message: 'Global dashboard analytics update process finished successfully.' });
        } else {
            console.error("[API Call] /api/analytics/updateAnalytics failed during calculation or saving."); // DEBUG LOG
            res.status(500).json({ message: 'Global dashboard analytics update process failed during calculation or saving.' });
        }
    } catch (error) {
        console.error("[API Call] Unexpected error in /api/analytics/updateAnalytics route:", error); // DEBUG LOG
        next(error);
    }
});

/**
 * GET /api/analytics/dashboardAnalytics (Corrected route name for clarity)
 * Retrieves the latest global dashboard analytics data.
 */
router.get("/dashboardAnalytics", async (req, res, next) => { // Renamed for clarity
    console.log(`[API Call] Received GET request to /api/analytics/dashboardAnalytics at ${new Date().toISOString()}`); // DEBUG LOG
    try {
        const analytics = await DashboardAnalytics.findOne({ identifier: 'main_dashboard' });

        if (!analytics) {
            console.log("[API Call] /api/analytics/dashboardAnalytics - Analytics data not found."); // DEBUG LOG
            return res.status(404).json({ message: 'Global analytics data not found. Run the update process first.' });
        }
        console.log("[API Call] /api/analytics/dashboardAnalytics - Analytics data retrieved successfully."); // DEBUG LOG
        res.status(200).json(analytics);
    } catch (err) {
        console.error("[API Call] Error fetching global dashboard data in /api/analytics/dashboardAnalytics:", err); // DEBUG LOG
        next(err);
    }
});

export default { router, updateDashboardAnalyticsDocument };
