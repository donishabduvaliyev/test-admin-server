/* --- models/DashboardAnalytics.js --- */
// Represents the aggregated global analytics data for the dashboard

import { Schema as _Schema, model} from "mongoose";
const Schema = _Schema;

// Sub-schema for chart data points (reusable)
const chartDataSchema = new Schema({
    // Label for the data point (e.g., "10:00", "Mon", "Week 1", "Jan")
    date: { type: String, required: true },
    // The aggregated value (e.g., total price) for that point
    total: { type: Number, required: true, min: 0 }
}, { _id: false });

// Sub-schema for the analytics data within a specific time period (reusable)
const timePeriodSchema = new Schema({
    orders: { type: Number, default: 0, min: 0 }, // Total orders in period
    price: { type: Number, default: 0, min: 0 }, // Total revenue in period
    deliveryOrders: { type: Number, default: 0, min: 0 }, // Count of delivery orders
    deliveryPrice: { type: Number, default: 0, min: 0 }, // Total revenue from delivery orders
    deliveryDistance: { type: Number, default: 0, min: 0 }, // Total delivery distance
    users: { type: Number, default: 0, min: 0 }, // Count of unique users placing orders
    // Array of chart data points for this period
    chart: { type: [chartDataSchema], default: [] }
}, { _id: false });

// Main schema for the single global dashboard analytics document
const dashboardAnalyticsSchema = new Schema({
    // Fixed identifier to ensure we only have one document for global stats
    identifier: {
        type: String,
        unique: true,
        required: true,
        default: 'main_dashboard'
    },
    // Embedded analytics data for different time periods
    today: { type: timePeriodSchema, default: () => ({}) },
    week: { type: timePeriodSchema, default: () => ({}) },
    month: { type: timePeriodSchema, default: () => ({}) },
    year: { type: timePeriodSchema, default: () => ({}) },
    // updatedAt will be automatically added by timestamps: true
}, {
    // Automatically add createdAt and updatedAt fields
    timestamps: true
});

const DashboardAnalytics = model("DashboardAnalytics", dashboardAnalyticsSchema , "dashboardAnalytics");
export default DashboardAnalytics;
