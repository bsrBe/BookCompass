const mongoose = require('mongoose')
const Order = require("../models/orderModel")
const Cart = require("../models/cartModel")
const Book = require("../models/bookModel")
const axios = require("axios")
require('dotenv').config();
const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY;
const CHAPA_API_URL = 'https://api.chapa.co/v1/transaction/initialize';
const CHAPA_VERIFY_URL = 'https://api.chapa.co/v1/transaction/verify/';

const createOrder = async (req, res) => {
  try {
    console.log("Incoming Request Body:", req.body);
    
    const { shippingAddress, itemsId } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!itemsId || itemsId.length === 0) {
      return res.status(400).json({ message: "No items selected" });
    }

    // Fetch books
    const books = await Book.find({ _id: { $in: itemsId } });
    if (books.length !== itemsId.length) {
      return res.status(400).json({ message: 'Some items not found' });
    }

    // Fetch user's cart
    const cart = await Cart.findOne({ user: userId }).populate('items.book');
    if (!cart) {
      return res.status(404).json({ message: "Cart not found for this user" });
    }

    // Filter selected items from cart
    const selectedItems = cart.items.filter(item =>
      itemsId.includes(item.book._id.toString())
    );
    if (selectedItems.length === 0) {
      return res.status(400).json({ message: "No valid items selected from the cart" });
    }

    // Check for existing order with same user and items (regardless of cart state)
    const existingOrder = await Order.findOne({
      user: userId,
      'items.book': { $all: itemsId },  // Matches all book IDs
      paymentStatus: { $in: ['pending', 'completed'] },  // Consider only active orders
    }).populate('items.book');

    if (existingOrder) {
      const existingItemsMap = new Map(existingOrder.items.map(item => [item.book._id.toString(), item.quantity]));
      const isRedundant = selectedItems.every(newItem => {
        const existingQuantity = existingItemsMap.get(newItem.book._id.toString());
        return existingQuantity !== undefined && existingQuantity === newItem.quantity;
      });

      if (isRedundant) {
        return res.status(400).json({ 
          message: "This order has already been placed with the same items and quantities.",
          existingOrderId: existingOrder._id
        });
      }
    }

    // Create order items
    const orderItems = selectedItems.map((item) => ({
      book: item.book._id,
      quantity: item.quantity,
      price: item.book.price,
      seller: item.book.seller,
    }));

    const totalPrice = orderItems.reduce((total, item) => total + item.price * item.quantity, 0);
    const txRef = `order-${userId}-${Date.now()}`;

    // Create the order
    const order = new Order({
      user: userId,
      cart: cart._id,
      items: orderItems,
      totalPrice,
      shippingAddress,
      paymentStatus: 'pending',
      txRef,
    });
    await order.save();

    // Chapa payment data
    const paymentData = {
      amount: totalPrice.toString(),
      currency: 'ETB',
      email: req.user.email || 'customer@example.com',
      first_name: req.user.name?.split(' ')[0] || 'Customer',
      last_name: req.user.name?.split(' ')[1] || 'User',
      tx_ref: txRef,
      callback_url: process.env.NODE_ENV === 'production' 
        ? 'https://bookcompass-backend.onrender.com/api/order/payment-callback' 
        : 'http://localhost:5000/api/order/payment-callback',
      return_url: process.env.NODE_ENV === 'production' 
        ? `https://bookcompass-backend.onrender.com/api/order/payment-success?tx_ref=${txRef}` 
        : `http://localhost:5000/api/order/payment-success?tx_ref=${txRef}`,
      "customization[title]": "Book Order Payment",
      "customization[description]": `Payment for order #${order._id}`,
    };

    const response = await axios.post(CHAPA_API_URL, paymentData, {
      headers: {
        Authorization: `Bearer ${CHAPA_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.data.status === 'success') {
      // Remove items from cart only after successful payment initialization
      cart.items = cart.items.filter((item) => !itemsId.includes(item.book._id.toString()));
      cart.totalPrice = cart.items.reduce((total, item) => 
        item.book && typeof item.book.price === 'number' ? total + item.quantity * item.book.price : total, 
        0
      );
      cart.totalPrice = Number(cart.totalPrice.toFixed(2));
      await cart.save();

      return res.status(200).json({
        order,
        checkoutUrl: response.data.data.checkout_url,
        txRef,
      });
    }
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(400).json({ error: error.message });
  }
};

// Verify payment after callback
const verifyPayment = async (req, res) => {
  try {const paymentSuccess = async (req, res) => {
  try {
    const { tx_ref } = req.query;
    if (!tx_ref) {
      return res.status(400).json({ message: 'Transaction reference (tx_ref) is missing' });
    }

    // Fetch the order from the database
    const order = await Order.findOne({ txRef: tx_ref })
      .populate('items.book')  // Populate book details
      .populate('items.seller');  // Populate seller details

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Optionally verify with Chapa (if you want real-time data instead of stored transactionDetails)
    const verifyUrl = `https://api.chapa.co/v1/transaction/verify/${tx_ref}`;
    const response = await axios.get(verifyUrl, {
      headers: {
        Authorization: `Bearer ${CHAPA_SECRET_KEY}`,
      },
    });

    if (response.data.status === 'success' && response.data.data.status === 'success') {
      res.status(200).json({
        message: 'Payment successful! Thank you for your purchase.',
        transactionDetails: order.transactionDetails || response.data.data,  // Use stored or fresh data
        items: order.items.map(item => ({
          bookTitle: item.book.title,  // From populated book
          price: item.price,
          quantity: item.quantity,
          sellerName: item.seller.name,  // From populated seller (assumes User has name field)
        })),
      });
    } else {
      res.status(400).json({ message: 'Payment not completed' });
    }
  } catch (error) {
    console.error("Error in paymentSuccess:", error.response ? error.response.data : error);
    res.status(500).json({ error: 'Error retrieving transaction details' });
  }
};
    const { tx_ref } = req.query;
    console.log('Received tx_ref:', tx_ref);

    if (!tx_ref) {
      return res.status(400).json({ message: 'Transaction reference (tx_ref) is missing' });
    }

    const verifyUrl = `https://api.chapa.co/v1/transaction/verify/${tx_ref}`;
    const response = await axios.get(verifyUrl, {
      headers: {
        Authorization: `Bearer ${CHAPA_SECRET_KEY}`,
      },
    });

    const order = await Order.findOne({ txRef: tx_ref });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (response.data.status === 'success' && response.data.data.status === 'success') {
      console.log('Transaction Details:', response.data.data);
      order.paymentStatus = 'paid';
      order.orderStatus = 'processing';
      order.transactionDetails = response.data.data; // Store details
      await order.save();

      for (const item of order.items) {
        await Book.findByIdAndUpdate(item.book, { $inc: { stock: -item.quantity } });
      }
      // Redirect with tx_ref
      res.redirect(`/api/order/payment-success?tx_ref=${tx_ref}`);
    } else {
      order.paymentStatus = 'failed';
      await order.save();
      res.status(400).json({ message: 'Payment verification failed' });
    }
  } catch (error) {
    console.error("Error verifying payment:", error.response ? error.response.data : error);
    res.status(500).json({ error: 'Error verifying payment' });
  }
};

// Payment success handler
const paymentSuccess = async (req, res) => {
  try {
    const { tx_ref } = req.query;
    if (!tx_ref) {
      return res.status(400).json({ message: 'Transaction reference (tx_ref) is missing' });
    }

    // Fetch the order from the database
    const order = await Order.findOne({ txRef: tx_ref })
      .populate('items.book')  // Populate book details
      .populate('items.seller');  // Populate seller details

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Optionally verify with Chapa (if you want real-time data instead of stored transactionDetails)
    const verifyUrl = `https://api.chapa.co/v1/transaction/verify/${tx_ref}`;
    const response = await axios.get(verifyUrl, {
      headers: {
        Authorization: `Bearer ${CHAPA_SECRET_KEY}`,
      },
    });

    if (response.data.status === 'success' && response.data.data.status === 'success') {
      res.status(200).json({
        message: 'Payment successful! Thank you for your purchase.',
        transactionDetails: order.transactionDetails || response.data.data,  // Use stored or fresh data
        items: order.items.map(item => ({
          bookTitle: item.book.title,  // From populated book
          price: item.price,
          quantity: item.quantity,
          sellerName: item.seller.name,  // From populated seller (assumes User has name field)
        })),
      });
    } else {
      res.status(400).json({ message: 'Payment not completed' });
    }
  } catch (error) {
    console.error("Error in paymentSuccess:", error.response ? error.response.data : error);
    res.status(500).json({ error: 'Error retrieving transaction details' });
  }
};



const getOrder = async (req, res) => {
  const isSeller = req.user.role === "seller";
  const userId = req.user.id;

  try {
      if (!isSeller) {
          // Fetch all orders where the user is the buyer
          const userOrders = await Order.find({ user: userId })
              .populate("user", "name email")
              // .populate("items.book", "name price");

          if (!userOrders || userOrders.length === 0) {
              return res.status(404).json({ error: "No orders found for this user" });
          }

          return res.status(200).json({ success: true, data: userOrders });
      }

      // Fetch all books that belong to the seller
      const sellerBooks = await Book.find({ seller: userId }).select("_id");

      if (sellerBooks.length === 0) {
          return res.status(404).json({ error: "No books found for this seller" });
      }

      const bookIds = sellerBooks.map((book) => book._id);

      // Fetch all orders containing books from this seller
      const sellerOrders = await Order.find({ "items.book": { $in: bookIds } })
          .populate("user", "name email") // Buyer info
          .populate("items.book", "name price"); // Book info

      if (sellerOrders.length === 0) {
          return res.status(404).json({ error: "No orders found for this seller" });
      }

      return res.status(200).json({ success: true, data: sellerOrders });
  } catch (error) {
      console.error("Error in getOrders:", error);
      res.status(400).json({ error: error.message });
  }
};


const getSingleOrder = async (req ,res) =>{
  const isSeller = req.user.role ==="seller"
const sellerId = req.user.id
  const {id} = req.params
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid Order ID format" });
      }
      if(!isSeller){
          const userSingleOrder = await Order.findOne({_id : id , user : req.user.id})
          if(!userSingleOrder){
            return res.status(404).json({message : "order not found"})
          }
          return res.status(200).json(userSingleOrder)

      }

      //getting books associated with the seller from the database
      const sellerBooks = await Book.find({seller : sellerId}).select("_id")
      //returning only the Id of the books in sellerBooks
      const bookIds = sellerBooks.map((book)=> book._id)
      if (bookIds.length === 0) {
        return res.status(404).json({ error: "Seller has no books, no associated orders" });
      }
      //retrieving all orders associated with the seller
      const singleOrders = await Order.findOne({_id : id , "items.book" : {$in : bookIds}})
      .populate("user" , "name email")//buyer info
      .populate("items.book" , "name price")
      if (!singleOrders) {
        return res.status(404).json({ error: "Order not found or not associated with seller" });
      }
      return res.status(200).json(singleOrders)
    } catch (error) {
        res.status(400).json({ error: error.message });
    }

}

const updateOrderStatus = async(req ,res) =>{

    try {
        const id = req.params.id
        const {status} = req.body

        const validStatus = ["processing", "shipped", "delivered" , "canceled"]
        if(!validStatus.includes(status)){
            return res.status(404).json({message : "not valid status"})
        }

        const updatedOrderStatus = await Order.findByIdAndUpdate(id , {orderStatus : status} , {new : true , setValidators : true})
        if (!updatedOrderStatus) {
            return res.status(404).json({ error: "Order not found." });
          }
        return res.status(200).json(updatedOrderStatus)
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

const cancelOrder = async (req ,res) => {

    try {
        const {id} = req.params
        const user = req.user.id

        const order = await Order.findOne({_id:id,user})
        if (!order) {
            return res.status(404).json({ error: "Order not found." });
          }

          if(order.orderStatus !== "processing"){
            return res.status(400).json({ error: "Order can not be canceled." });
          }
        order.orderStatus = "canceled"

        await order.save()

        for(const item of order.items){
            await Book.findByIdAndUpdate(item.book, { $inc: { stock: item.quantity } });
        }
        res.status(200).json({ success: true, data: order })
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

const deleteOrder = async (req, res) => {

    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid Order ID format" });
      }
  
      // Delete the order
      const order = await Order.findByIdAndDelete({_id:id});
  
      if (!order) {
        return res.status(404).json({ error: "Order not found." });
      }
  
      res.status(200).json({ success: true, message: "Order deleted successfully." });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  const getOrderReports = async (req, res) => {
    const isSeller = req.user.role ==="seller"
const sellerId = req.user.id
    try {
      if (req.user.role === "seller") {
        const sellerBooks = await Book.find({ seller: req.user.id }).select("_id");

        if (sellerBooks.length === 0) {
            return res.status(404).json({ error: "No books found for this seller." });
        }

        const bookIds = sellerBooks.map(book => book._id);

        const orders = await Order.aggregate([
            { $match: { "items.book": { $in: bookIds } } }, // Filter by seller's books
            {
                $group: {
                    _id: "$orderStatus",
                    count: { $sum: 1 },
                    totalRevenue: { $sum: "$totalPrice" },
                },
            },
        ]);
  
      res.status(200).json({ success: true, data: orders });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

module.exports = {
    createOrder,
    getOrder,
    getSingleOrder,
    updateOrderStatus,
    deleteOrder,
    cancelOrder,
    getOrderReports,
    verifyPayment,
    paymentSuccess,
  };