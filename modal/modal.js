// import { Schema, model } from "mongoose";

// const FoodSchema = new Schema({
//   name: { type: String, required: true },
//   price: { type: Number, required: true },
//   section: { type: String, required: true }, // Example: "Pizza", "Burger"
//   sizes: [{ type: String }], // Example: ["Small", "Medium", "Large"]
//   toppings: [{ type: String }], // Example: ["Cheese", "Mushroom"]
//   imageUrl: { type: String, required: true },

// });

// export default model("Food", FoodSchema ,  "productData");


import { Schema, model } from "mongoose";

const FoodSchema = new Schema({
  categories: [String], 
  items: [
    {
      name: String,
      price: Number,
      image: String,
      isAviable: Boolean ,
      category: String,
      toppings: [
        {
          name: String,
          price: Number
        }

      ],
      sizes: [
        {
          name: String,
          price: Number
        }
      ]
    }
  ]
});


export default model("Food", FoodSchema, "productData");



