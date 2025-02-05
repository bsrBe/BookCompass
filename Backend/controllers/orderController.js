const mongoose = require('mongoose')
const Order = require("../models/orderModel")
const Cart = require("../models/cartModel")
const Book = require("../models/bookModel")

const createOrder = async (req, res) => {
  try {
    console.log("Incoming Request Body:", req.body);
    
    const { shippingAddress, itemsId } = req.body;
    const userId = req.user.id;

    const cart = await Cart.findOne({ user: userId }).populate('items.book');
    
    if (!cart) {
      return res.status(404).json({ message: "Cart not found for this user" });
    }

    if (!itemsId || itemsId.length === 0) {
      return res.status(400).json({ message: "No items selected" });
    }

    // Filter the selected items from the cart
    const selectedItems = cart.items.filter(item =>
      itemsId.includes(item.book._id.toString())
    );

    if (!selectedItems || selectedItems.length === 0) {
      return res.status(400).json({ message: "No valid items selected from the cart" });
    }

    // Check if an order with the same user, cart, and items already exists
    const existingOrder = await Order.findOne({ user: userId, cart: cart._id }).populate('items.book');

    if (existingOrder) {
      // Create a map for existing items by book _id for efficient lookup
      const existingItemsMap = new Map(existingOrder.items.map(item => [item.book._id.toString(), item]));

      // Check if the selected items already exist in the existing order
      const isRedundant = selectedItems.every(newItem => {
        const existingItem = existingItemsMap.get(newItem.book._id.toString());
        return existingItem && existingItem.quantity === newItem.quantity;
      });

      if (isRedundant) {
        return res.status(400).json({ message: "This order has already been placed with the same items and quantities." });
      }
    }

    // Create the order items and calculate the total price
    const orderItems = selectedItems.map((item) => ({
      book: item.book._id,
      quantity: item.quantity,
      price: item.book.price,
    }));

    const totalPrice = selectedItems.reduce((total, item) => total + item.book.price * item.quantity, 0);

    // Create the order document
    const order = new Order({
      user: userId,
      cart: cart._id,
      items: orderItems,
      totalPrice,
      shippingAddress,
    });

    await order.save();

    // Remove the selected items from the cart and update the total price
    cart.items = cart.items.filter((item) => !itemsId.includes(item._id.toString()));
    cart.totalPrice = cart.items.reduce((total, item) => {
      if (item.book && typeof item.book.price === 'number') {
        return total + item.quantity * item.book.price;
      }
      return total;
    }, 0);

    cart.totalPrice = Number(cart.totalPrice.toFixed(2)); // Ensure two decimal places
    await cart.save();

    // Update the stock of books in the selected items
    for (const item of selectedItems) {
      await Book.findByIdAndUpdate(item.book._id, { $inc: { stock: -item.quantity } });
    }

    return res.status(200).json(order);
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(400).json({ error: error.message });
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

  module.exports = {createOrder , getOrder , getSingleOrder , updateOrderStatus , deleteOrder , cancelOrder , getOrderReports }