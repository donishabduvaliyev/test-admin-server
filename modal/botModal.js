import { Schema, model } from "mongoose";

const scheduleSchema = new Schema({
    schedule: {
        Dushanba: { startHour: Number, endHour: Number },
        Seshanba: { startHour: Number, endHour: Number },
        Chorshanba: { startHour: Number, endHour: Number },
        Payshanba: { startHour: Number, endHour: Number },
        Juma: { startHour: Number, endHour: Number },
        Shanba: { startHour: Number, endHour: Number },
        Yakshanba: { startHour: Number, endHour: Number }
    },
    isEmergencyOff: { type: Boolean, default: false } 
}, { timestamps: true });

const ScheduleModel = model("Schedule", scheduleSchema , "botEdit");
export default ScheduleModel;
