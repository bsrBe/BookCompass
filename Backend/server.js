const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")
const connectDB = require("./config/db")
const app = express()
const swaggerUi = require('swagger-ui-express')
const YAML = require("yamljs");
const maintenanceMiddleware = require("./middlewares/maintenanceMiddleware"); // Import maintenance middleware
const authRoutes = require("./routes/authRoutes")
const booksRoutes = require("./routes/bookRoutes")
const cartRoutes = require("./routes/cartRoutes")
const orderRoutes = require("./routes/orderRoutes")
const reviewRoutes = require("./routes/reviewRoutes");
const adminRoutes = require("./routes/adminRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const userRoutes = require("./routes/userRoutes");
const sellerRoutes = require("./routes/sellerRoutes");
const interactionRoutes = require("./routes/interactionRoutes"); // Add interaction routes
const wishlistRoutes = require("./routes/wishlistRoutes");
const bookShopRoutes = require("./routes/bookShopRoutes");
// const opn = require('opn');
const path = require("path"); 
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000','https://bookapi-c2zu.onrender.com' ,'https://bookcompass.onrender.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.options('*', cors()); // Handle preflight OPTIONS requests


app.use(express.json());
require("dotenv").config(); // Corrected: Assumes .env is in the Backend directory
// app.use(cors({
//   origin: ['http://localhost:3000', 'https://bookcompass.onrender.com'],
//   credentials: true
// }));
// const allowedOrigins = ["http://localhost:5173", "http://localhost:4173", "http://localhost:5000" , "bookCompass.html"];

// app.use(
//   cors({
//     origin: function (origin, callback) {
//       if (!origin || allowedOrigins.includes(origin)) {
//         callback(null, true);
//       } else {
//         callback(new Error("Not allowed by Cors"));
//       }
//     },
//     credentials: true,
//   })
// );

// app.use(express.static(__dirname));
// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, 'test.html'));
// });
const swaggerDocument = YAML.load("./swagger.yaml");
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  swaggerOptions: {
    withCredentials: true,  // Make sure cookies are sent with requests
  }
}));

app.use(cookieParser());

// Apply maintenance mode check globally before API routes
app.use(maintenanceMiddleware);

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/books" ,booksRoutes);
app.use("/api/cart" , cartRoutes);
app.use("/api/order" , orderRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/webhook", webhookRoutes);
app.use('/api/users', userRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/wishlist',wishlistRoutes);
app.use("/api/bookshop", bookShopRoutes);

connectDB();


app.listen(5000, () => {
  console.log("server listening on Port",process.env.PORT||5000);
});
