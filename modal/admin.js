import { Schema, model } from "mongoose";

const AdminSchema = new Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    
});

export default model("Admin", AdminSchema , "admin");
