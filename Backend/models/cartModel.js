const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },

  items: [
    {
      book: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "bookModel",
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
        default: 1,
      },
      
    },
  ],
  totalPrice : {
    type : Number,
    default : 0
  } 
} ,{ timestamps : true});

module.exports = mongoose.model("Cart" , cartSchema)