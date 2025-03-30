const mongoose = require('mongoose')
const Order = require("../models/orderModel")
const Cart = require("../models/cartModel")
const Book = require("../models/bookModel")
const User = require("../models/userModel")
const axios = require("axios")
require('dotenv').config();
const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY;
const CHAPA_API_URL = 'https://api.chapa.co/v1/transaction/initialize';
const CHAPA_VERIFY_URL = 'https://api.chapa.co/v1/transaction/verify/';

const geocodeAddress = async (address) => {
  try {
    // 1. Clean and prepare the address
    const cleanedAddress = address
      .replace(/,+/g, ', ')
      .replace(/\s+/g, ' ')
      .trim();

    // 2. Special cases for Ethiopian locations commonly misgeocoded
    const ETHIOPIAN_LOCATIONS = {
      'mexico': { lat: 9.001442, lng: 38.6771697 }, // Mexico Square, Addis Ababa
      'mexico, addis ababa': { lat: 9.001442, lng: 38.6771697 },
      'bole': { lat: 8.9806, lng: 38.7998 }, // Bole, Addis Ababa
      'piassa': { lat: 9.0300, lng: 38.7500 } // Piazza, Addis Ababa
    };

    const normalizedAddress = cleanedAddress.toLowerCase();
    if (ETHIOPIAN_LOCATIONS[normalizedAddress]) {
      return ETHIOPIAN_LOCATIONS[normalizedAddress];
    }

    // 3. Force Ethiopia context in search
    const ethiopiaQuery = cleanedAddress.includes("Ethiopia") 
      ? cleanedAddress 
      : `${cleanedAddress}, Ethiopia`;

    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(ethiopiaQuery)}&countrycodes=et&limit=1`
    );

    // 4. Validate the result is in Ethiopia
    if (response.data?.length > 0) {
      const result = response.data[0];
      const lat = parseFloat(result.lat);
      const lon = parseFloat(result.lon);

      // Ethiopia bounding box check
      if (lat >= 3.4 && lat <= 14.9 && lon >= 33.0 && lon <= 48.0) {
        return { lat, lng: lon };
      }
    }

    // 5. Fallback to component search if full address fails
    const components = cleanedAddress.split(',').map(c => c.trim());
    for (let i = 0; i < components.length; i++) {
      const partialQuery = `${components.slice(i).join(', ')}, Ethiopia`;
      const fallbackResponse = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(partialQuery)}&countrycodes=et&limit=1`
      );

      if (fallbackResponse.data?.length > 0) {
        const result = fallbackResponse.data[0];
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        
        if (lat >= 3.4 && lat <= 14.9 && lon >= 33.0 && lon <= 48.0) {
          return { lat, lng: lon };
        }
      }
    }

    throw new Error('Address not found in Ethiopia');
    
  } catch (error) {
    console.error('Geocoding error:', error);
    throw new Error(`Could not locate "${address}" in Ethiopia. Please try format: "Neighborhood, City, Ethiopia"`);
  }
};
const getDistance = async (point1, point2) => {
  try {
    // Use free OSRM service
    const response = await axios.get(
      `http://router.project-osrm.org/route/v1/driving/${point1.lng},${point1.lat};${point2.lng},${point2.lat}?overview=false`
    );
    
    if (!response.data.routes?.[0]) {
      throw new Error('No route found');
    }
    
    return response.data.routes[0].distance / 1000; // Convert to km
  } catch (error) {
    console.error('Distance calculation error:', error);
    throw new Error('Failed to calculate distance');
  }
};

const createOrder = async (req, res) => {
  try {
    const { shippingAddress, itemsId } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!itemsId || itemsId.length === 0) {
      return res.status(400).json({ message: "No items selected" });
    }

    // Fetch books with properly populated seller data
    const books = await Book.find({ _id: { $in: itemsId } })
      .populate({
        path: 'seller',
        select: 'name email location',
        transform: (doc) => {
          // Transform the seller data to ensure consistent location format
          if (doc.location && doc.location.coordinates) {
            return {
              ...doc.toObject(),
              location: {
                address: doc.location.address,
                coordinates: {
                  lat: parseFloat(doc.location.coordinates.lat),
                  lng: parseFloat(doc.location.coordinates.lng)
                }
              }
            };
          }
          return doc;
        }
      });
      
      console.log('Populated books:', JSON.stringify(books, null, 2));

    if (books.length !== itemsId.length) {
      return res.status(400).json({ message: 'Some items not found' });
    }
 // Fetch user's cart

 const cart = await Cart.findOne({ user: userId }).populate({
  path: 'items.book',
  populate: {
    path: 'seller',
    select: 'name email location'
  }
});
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

 // Check for existing order
 const existingOrder = await Order.findOne({
   user: userId,
   'items.book': { $all: itemsId },
   paymentStatus: { $in: ['pending', 'completed'] },
 }).populate('items.book');

 if (existingOrder) {
   const existingItemsMap = new Map(existingOrder.items.map(item => 
     [item.book._id.toString(), item.quantity]
   ));
   const isRedundant = selectedItems.every(newItem => {
     const existingQuantity = existingItemsMap.get(newItem.book._id.toString());
     return existingQuantity === newItem.quantity;
   });

   if (isRedundant) {
     return res.status(400).json({ 
       message: "This order has already been placed",
       existingOrderId: existingOrder._id
     });
   }
 }



    // Group items by seller with enhanced location handling
    const sellerGroups = new Map();

    selectedItems.forEach((item) => {
      const sellerId = item.book.seller._id.toString();
      if (!sellerGroups.has(sellerId)) {
        const hasValidLocation = (
          item.book.seller.location &&
          item.book.seller.location.coordinates &&
          typeof item.book.seller.location.coordinates.lat === 'number' &&
          typeof item.book.seller.location.coordinates.lng === 'number'
        );
        console.log(`Seller ${sellerId} data:`, JSON.stringify(item.book.seller, null, 2));
        sellerGroups.set(sellerId, {
          seller: item.book.seller,
          items: [],
          subtotal: 0,
          hasValidLocation,
          sellerLocation: hasValidLocation ? {
            lat: item.book.seller.location.coordinates.lat,
            lng: item.book.seller.location.coordinates.lng
          } : null
        });
      }
      
      const sellerGroup = sellerGroups.get(sellerId);
      const orderItem = {
        book: item.book._id,
        quantity: item.quantity,
        price: item.book.price,
        seller: sellerId,
      };
      
      sellerGroup.items.push(orderItem);
      sellerGroup.subtotal += orderItem.price * orderItem.quantity;
    });

    // Process each seller group with improved error handling
    const sellerGroupsArray = Array.from(sellerGroups.values());
    let shippingCoords = [38.7636, 9.0054]; // Default to Addis center
    
    try {
      const geocoded = await geocodeAddress(shippingAddress);
      if (geocoded.coordinates) {
        shippingCoords = [geocoded.coordinates.lng, geocoded.coordinates.lat];
      }
    } catch (geocodeError) {
      console.error("Geocoding failed:", geocodeError.message);
    }

    await Promise.all(sellerGroupsArray.map(async (group) => {
      try {
        if (!group.hasValidLocation || !group.sellerLocation) {
          throw new Error("Seller location not properly formatted");
        }

        // Calculate distance and delivery fee
        const distance = await getDistance(group.sellerLocation, { lat: shippingCoords[1], lng: shippingCoords[0] });
        group.deliveryFee = Math.max(50, Math.min(distance * 10, 500));
        group.distance = distance;
        group.total = group.subtotal + group.deliveryFee;
        
        // Store location data for order document
        group.fromLocation = {
          type: 'Point',
          coordinates: [
            group.sellerLocation.lng,
            group.sellerLocation.lat
          ]
        };
        
      } catch (error) {
        console.error(`Delivery calculation for seller ${group.seller._id}:`, error.message);
        // Default values with more context
        group.deliveryFee = 100;
        group.distance = null;
        group.total = group.subtotal + 100;
        group.fromLocation = {
          type: 'Point',
          coordinates: [38.7636, 9.0054],
          note: 'Default location used'
        };
        group.locationError = error.message;
      }
    }));

    // Create the order document with enhanced debugging info
    const allOrderItems = sellerGroupsArray.flatMap(group => group.items);
    const order = new Order({
      user: userId,
      cart: cart._id,
      items: allOrderItems,
      pricing: {
        subtotal: sellerGroupsArray.reduce((sum, g) => sum + g.subtotal, 0),
        deliveryFee: sellerGroupsArray.reduce((sum, g) => sum + g.deliveryFee, 0),
        total: sellerGroupsArray.reduce((sum, g) => sum + g.total, 0),
        sellerBreakdown: sellerGroupsArray.map(group => ({
          seller: group.seller._id,
          subtotal: group.subtotal,
          deliveryFee: group.deliveryFee,
          total: group.total,
          distance: group.distance,
          fromLocation: group.fromLocation,
          toLocation: {
            type: 'Point',
            coordinates: shippingCoords
          },
          ...(group.locationError ? { locationError: group.locationError } : {})
        }))
      },
      shippingAddress,
      shippingLocation: {
        type: 'Point',
        coordinates: shippingCoords,
        ...(shippingCoords[0] === 38.7636 && shippingCoords[1] === 9.0054 ? { note: 'Default location used' } : {})
      },
      paymentStatus: 'pending',
      txRef: `order-${userId}-${Date.now()}`
    });

    await order.save();

    // Prepare payment data
    // const paymentData = {
    //   amount: order.pricing.total.toString(),
    //   currency: 'ETB',
    //   email: req.user.email || 'customer@example.com',
    //   first_name: req.user.name?.split(' ')[0] || 'Customer',
    //   last_name: req.user.name?.split(' ')[1] || 'User',
    //   tx_ref: order.txRef,
    //   callback_url: process.env.NODE_ENV === 'production' 
    //     ? 'https://your-production-url.com/api/order/payment-callback' 
    //     : 'http://localhost:5000/api/order/payment-callback',
    //   return_url: process.env.NODE_ENV === 'production' 
    //     ? `https://your-production-url.com/api/order/payment-success?tx_ref=${order.txRef}` 
    //     : `http://localhost:5000/api/order/payment-success?tx_ref=${order.txRef}`,
    //   "customization[title]": "Book Order Payment",
    //   "customization[description]": `Payment for order #${order._id}`,
    // };
    const paymentData = {
      amount: order.pricing.total.toString(),
      currency: 'ETB',
      email: req.user.email || 'customer@example.com',
      first_name: req.user.name?.split(' ')[0] || 'Customer',
      last_name: req.user.name?.split(' ')[1] || 'User',
      tx_ref: order.txRef,
      callback_url: process.env.NODE_ENV === 'production' 
        ? `https://your-production-url.com/api/order/payment-callback?tx_ref=${order.txRef}` 
        : `http://localhost:5000/api/order/payment-callback?tx_ref=${order.txRef}`,
      return_url: process.env.NODE_ENV === 'production' 
        ? `https://your-production-url.com/api/order/payment-success?tx_ref=${order.txRef}` 
        : `http://localhost:5000/api/order/payment-success?tx_ref=${order.txRef}`,
      "customization[title]": "Book Order Payment",
      "customization[description]": `Payment for order #${order._id}`,
    };

    // Initiate payment
    const response = await axios.post(CHAPA_API_URL, paymentData, {
      headers: {
        Authorization: `Bearer ${CHAPA_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.data.status === 'success') {
      // Update cart by removing ordered items
      cart.items = cart.items.filter((item) => !itemsId.includes(item.book._id.toString()));
      cart.totalPrice = cart.items.reduce((total, item) => 
        item.book?.price ? total + (item.quantity * item.book.price) : total, 
        0
      );
      await cart.save();

      return res.status(200).json({
        order,
        checkoutUrl: response.data.data.checkout_url,
        txRef: order.txRef,
      });
    } else {
      throw new Error('Payment initiation failed');
    }
  } catch (error) {
    console.error("Order creation failed:", error);
    res.status(400).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};



// const verifyPayment = async (req, res) => {
//   try {
//     const tx_ref = req.query.tx_ref || req.body.tx_ref;
//     console.log('Received tx_ref:', tx_ref);
//     if (!tx_ref) {
//       return res.status(400).json({ message: 'Transaction reference (tx_ref) is missing' });
//     }

//     const verifyUrl = `https://api.chapa.co/v1/transaction/verify/${tx_ref}`;
//     const response = await axios.get(verifyUrl, {
//       headers: { Authorization: `Bearer ${CHAPA_SECRET_KEY}` },
//     });

//     const order = await Order.findOne({ txRef: tx_ref });
//     if (!order) {
//       return res.status(404).json({ message: 'Order not found' });
//     }

//     if (response.data.status === 'success' && response.data.data.status === 'success') {
//       order.paymentStatus = 'paid';
//       order.orderStatus = 'processing';
//       order.transactionDetails = response.data.data;
//       await order.save();
//       for (const item of order.items) {
//         await Book.findByIdAndUpdate(item.book, { $inc: { stock: -item.quantity } });
//       }
//       res.redirect(`/api/order/payment-success?tx_ref=${tx_ref}`);
//     } else {
//       order.paymentStatus = 'failed';
//       await order.save();
//       res.status(400).json({ message: 'Payment verification failed' });
//     }
//   } catch (error) {
//     console.error("Error verifying payment:", error.response ? error.response.data : error);
//     res.status(500).json({ error: 'Error verifying payment' });
//   }
// };

// Payment success handler
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
          deliveryFee: order.deliveryFee,
          subtotal: order.totalPrice - order.deliveryFee, // Items cost
         totalPrice: order.totalPrice,
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