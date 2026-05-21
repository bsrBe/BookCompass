# BookCompass

A full-featured backend API for a book marketplace platform integrated with Chapa payment gateway for seamless transaction processing.

## 🎯 Overview

BookCompass is a robust and scalable backend API designed to power a modern book marketplace. It provides comprehensive functionality for managing books, users, transactions, and integrates with Chapa to handle secure payment processing.

## ✨ Features

- **Book Management**: Create, read, update, and delete book listings
- **User Management**: User authentication and profile management
- **Order Processing**: Complete order lifecycle management
- **Payment Integration**: Secure payment processing via Chapa payment gateway
- **Search & Filter**: Advanced search and filtering capabilities for book discovery
- **Reviews & Ratings**: User review and rating system for books
- **Inventory Management**: Real-time stock tracking and management

## 🛠️ Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js / Express (API)
- **Payment Gateway**: Chapa

### Language Composition
- HTML: 75.9%
- JavaScript: 23.7%
- CSS: 0.4%

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn package manager
- Chapa API credentials

### Installation

1. Clone the repository:
```bash
git clone https://github.com/bsrBe/BookCompass.git
cd BookCompass
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add your configuration:
```env
PORT=5000
DATABASE_URL=your_database_url
CHAPA_API_KEY=your_chapa_api_key
JWT_SECRET=your_jwt_secret
```

4. Start the development server:
```bash
npm start
```

The API will be available at `http://localhost:5000`

## 📚 API Documentation

### Authentication
- User registration and login endpoints
- JWT-based authentication
- Token refresh mechanism

### Books
- `GET /api/books` - Get all books
- `GET /api/books/:id` - Get a specific book
- `POST /api/books` - Create a new book listing
- `PUT /api/books/:id` - Update a book
- `DELETE /api/books/:id` - Delete a book

### Orders
- `GET /api/orders` - Get user orders
- `POST /api/orders` - Create a new order
- `GET /api/orders/:id` - Get order details

### Payments
- `POST /api/payments/initialize` - Initialize payment with Chapa
- `POST /api/payments/callback` - Handle Chapa payment callback
- `GET /api/payments/:id` - Get payment status

## 🔐 Security Features

- JWT-based authentication
- Password encryption
- Secure payment processing with Chapa
- Input validation and sanitization
- Error handling and logging

## 📝 Project Structure

```
BookCompass/
├── src/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── utils/
│   └── config/
├── public/
├── tests/
├── .env.example
├── package.json
└── README.md
```

## 🧪 Testing

Run tests using:
```bash
npm test
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support, please open an issue on the GitHub repository or contact the maintainers.

## 👨‍💻 Author

**bsrBe** - [GitHub Profile](https://github.com/bsrBe)

## 📞 Contact

For inquiries or questions, please feel free to reach out through GitHub issues or discussions.

---

**Happy coding!** 🎉
