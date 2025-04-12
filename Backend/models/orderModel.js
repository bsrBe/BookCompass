// const mongoose = require("mongoose");

// const orderSchema = new mongoose.Schema(
//   {
//     user: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     cart: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Cart",
//       required: true,
//     },
//     items: [
//       {
//         seller: {
//           type: mongoose.Schema.Types.ObjectId,
//           ref: "User",
//           required: true,
//         },
//         book: {
//           type: mongoose.Schema.Types.ObjectId,
//           ref: "bookModel",
//           required: true,
//         },
//         quantity: {
//           type: Number,
//           required: true,
//         },
//         price: {
//           type: Number,
//           required: true,
//         },
//       },
//     ],
//     totalPrice: { type: Number, required: true },
//     paymentStatus: {
//       type: String,
//       enum: ["pending", "paid", "failed"],
//       default: "pending",
//     },
//     orderStatus: {
//       type: String,
//       enum: ["processing", "shipped", "delivered", "canceled"],
//       default: "processing",
//     },
//     txRef: {
//       type: String,
//       unique: true,
//     },
//     deliveryFee: { type: Number, default: 0 },
//     transactionDetails: { type: Object },
//     shippingAddress: { type: String, required: true },
//   },
  
//   { timestamps: true }
// );

// module.exports = mongoose.model("Order", orderSchema);
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    cart: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cart",
      required: true,
    },
    items: [
      {
        seller: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        book: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "bookModel",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
      },
    ],
    pricing: {
      subtotal: { type: Number, required: true },
      deliveryFee: { type: Number, required: true },
      total: { type: Number, required: true },
      sellerBreakdown: [
        {
          seller: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          subtotal: Number,
          deliveryFee: Number,
          total: Number,
          distance: Number, // in kilometers
          fromLocation: { // seller's location
            type: {
              type: String,
              enum: ['Point'],
              default: 'Point'
            },
            coordinates: [Number] // [longitude, latitude]
          },
          toLocation: { // customer's location
            type: {
              type: String,
              enum: ['Point'],
              default: 'Point'
            },
            coordinates: [Number] // [longitude, latitude]
          }
        }
      ]
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    orderStatus: {
      type: String,
      enum: ["processing", "shipped", "delivered", "canceled"],
      default: "processing",
    },
    txRef: {
      type: String,
      unique: true,
    },
    transactionDetails: { type: Object },
    shippingAddress: { type: String},
    shippingLocation: { // geocoded customer location
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: [Number] // [longitude, latitude]
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Geospatial index for seller locations
orderSchema.index({ "pricing.sellerBreakdown.fromLocation": "2dsphere" });
orderSchema.index({ "shippingLocation": "2dsphere" });

// Virtual for simplified frontend display
orderSchema.virtual('deliveryFee').get(function() {
  return this.pricing.deliveryFee;
});

orderSchema.virtual('totalPrice').get(function() {
  return this.pricing.total;
});

module.exports = mongoose.model("Order", orderSchema);