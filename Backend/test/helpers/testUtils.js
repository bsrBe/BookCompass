const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../../models/userModel');
const Book = require('../../models/bookModel');
const BookShop = require('../../models/bookShopModel');

const createTestUser = async (userData = {}) => {
  const timestamp = Date.now();
  const defaultUser = {
    name: 'Test User',
    email: `test${timestamp}@example.com`,
    password: 'password123',
    role: 'buyer',
    ...userData
  };
  return await User.create(defaultUser);
};

const createTestBookShop = async (sellerId) => {
  const defaultShop = {
    name: `Test Shop ${Date.now()}`,
    tagline: 'Test Tagline',
    description: 'Test Description',
    contact: {
      phoneNumber: '+251912345678',
      email: `shop${Date.now()}@example.com`
    },
    location: {
      type: 'Point',
      coordinates: [38.7, 9.0], // Addis Ababa coordinates
      address: 'Test Address'
    },
    seller: sellerId
  };
  return await BookShop.create(defaultShop);
};

const createTestBook = async (bookData = {}) => {
  // Create a seller and shop first
  const seller = await createTestUser({ role: 'seller' });
  const shop = await createTestBookShop(seller._id);

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
    seller: seller._id,
    shop: shop._id,
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
  const shop = await createTestBookShop(user._id);
  const book = await createTestBook({ ...bookData, seller: user._id, shop: shop._id });
  return { book, user, shop };
};

module.exports = {
  createTestUser,
  createTestBook,
  createTestBookShop,
  generateTestToken,
  setupTestUser,
  setupTestBook
}; 