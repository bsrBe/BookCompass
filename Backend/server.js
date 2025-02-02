const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")
const connectDB = require("./config/db")
const app = express()
const swaggerUi = require('swagger-ui-express')
const YAML = require("yamljs");
const authRoutes = require("./routes/authRoutes")
const booksRoutes = require("./routes/bookRoutes")
const cartRoutes = require("./routes/cartRoutes")


require("dotenv").config({path:'/config/.env'});

const allowedOrigins = ["http://localhost:5173", "http://localhost:4173", "http://localhost:5000"];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by Cors"));
      }
    },
    credentials: true,
  })
);

const swaggerDocument = YAML.load("./swagger.yaml");
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  swaggerOptions: {
    withCredentials: true,  // Make sure cookies are sent with requests
  }
}));

app.use(cookieParser());
app.use(express.json());



app.use("/api/auth", authRoutes);
app.use("/api/books" ,booksRoutes);
app.use("/api/cart" , cartRoutes);
connectDB();

app.listen(5000, () => {
  console.log("server listening on Port",process.env.PORT||5000);
});
