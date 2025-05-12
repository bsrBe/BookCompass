const Cart = require("../models/cartModel")

const getCart = async ( req ,res ) => {
    try {
        const getCart = await Cart.find({user : req.user.id}).populate("items.book")
        if(!getCart){
            return res.status(404).json({message : "no cart found"})
        }
        return res.status(200).json({success : true , data : getCart})
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
}



  const addToCart = async (req, res) => {
    try {
      const { bookId, quantity } = req.body;
      if (!bookId || quantity <= 0) {
        return res.status(400).json({ message: "Invalid book ID or quantity" });
    }
      let cart = await Cart.findOne({ user: req.user.id }).populate("items.book");

      if (!cart) {
        cart = new Cart({ user: req.user.id, items: [] });
      }
      if (!cart.items) {
        cart.items = [];
      }
      const itemIndex = cart.items.findIndex((item) => item.book && item.book._id.toString() === bookId);
      if (itemIndex >= 0) {
        // Update the quantity of the existing item
        cart.items[itemIndex].quantity =Number(cart.items[itemIndex].quantity)  + Number(quantity);
      } else {
        // Add a new item to the cart
        cart.items.push({ book: bookId, quantity : Number(quantity) });
      }  
      cart = await cart.populate({
  path: "items.book",
  select: "-fileUrl"
});
      cart.items = cart.items.filter(item => item.book && item.book.price);
      cart.totalPrice = cart.items.reduce((total, item) => total + item.quantity * item.book.price, 0);
      await cart.save();
      res.status(200).json({ success: true, data: cart });
    } catch (error) {
      console.error("Error in addToCart:", error);
      res.status(400).json({ error: error.message });
    }
  };

  const updateCart = async (req, res) => {
    try {
      const bookId = req.params.id
      const quantity  = req.body.quantity

      if (!bookId || quantity <= 0) {
        return res.status(400).json({ message: "Invalid book ID or quantity" });
    }
      let cart = await Cart.findOne({ user: req.user.id }).populate("items.book");

      if (!cart) {
        cart = new Cart({ user: req.user.id, items: [] });
      }
      if (!cart.items) {
        cart.items = [];
      }
      const itemIndex = cart.items.findIndex((item) => item.book && item.book._id.toString() === bookId);
      if (itemIndex >= 0) {
        // Update the quantity of the existing item
        cart.items[itemIndex].quantity = Number(quantity);
      } else {
        // Add a new item to the cart
        cart.items.push({ book: bookId, quantity : Number(quantity) });
      }
     
      cart.items = cart.items.filter(item => item.book && item.book.price);
      cart.totalPrice = cart.items.reduce((total, item) => total + item.quantity * item.book.price, 0);
      await cart.save();
      res.status(200).json({ success: true, data: cart });
    } catch (error) {
      console.error("Error in addToCart:", error);
      res.status(400).json({ error: error.message });
    }
  };

const deleteCartItem = async ( req , res ) => {
    try {
        const  bookId  = req.params.id
        const cart = await Cart.findOne({user : req.user.id}).populate("items.book")
        if (!cart) {
            return res.status(404).json({ success: false, message: "No cart found for this user." });
          }
      
        const itemIndex = cart.items.findIndex((item) => item.book._id.toString() === bookId)

        if(itemIndex !== -1){
            cart.items.splice(itemIndex ,1)
        }
       
      
        cart.totalPrice = cart.items.reduce((total, item) => total + item.quantity * item.book.price, 0);
        await cart.save()
        res.status(200).json({message :  "cart item deleted successfully"})

    } catch (error) {
        res.status(400).json({ message: error.message });
    }
}

module.exports = {getCart,addToCart , updateCart , deleteCartItem};