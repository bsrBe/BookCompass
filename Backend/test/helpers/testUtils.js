const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../../models/userModel');
const Book = require('../../models/bookModel');

const createTestUser = async (userData = {}) => {
  const timestamp = Date.now();
  const defaultUser = {
    name: 'Test User',
    email: `test${timestamp}@example.com`,
    password: 'password123',
    role: 'user',
    ...userData
  };
  return await User.create(defaultUser);
};

const createTestBook = async (bookData = {}) => {
  const defaultBook = {
    title: 'Test Book',
    author: 'Test Author',
    description: 'Test Description',
    price: 19.99,
    category: 'Fiction',
    isbn: '9783161484100',
    isDigital: false,
    isAudiobook: false,
    stock: 10,
    seller: new mongoose.Types.ObjectId(),
    ...bookData
  };

  // Handle digital and audiobook types
  if (bookData.isDigital || bookData.isAudiobook) {
    defaultBook.stock = null;
    defaultBook.fileUrl = 'https://example.com/book.pdf';
  }

  return await Book.create(defaultBook);
};

const generateTestToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

const setupTestUser = async (userData = {}) => {
  const user = await createTestUser(userData);
  const token = generateTestToken(user);
  return { user, token };
};

const setupTestBook = async (bookData = {}) => {
  const { user } = await setupTestUser({ role: 'seller' });
  const book = await createTestBook({ ...bookData, seller: user._id });
  return { book, user };
};

module.exports = {
  createTestUser,
  createTestBook,
  generateTestToken,
  setupTestUser,
  setupTestBook
}; 