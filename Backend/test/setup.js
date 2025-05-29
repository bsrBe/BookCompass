const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

let mongod;

// Set test environment variables
process.env.PORT = 0; // Use random available port
process.env.NODE_ENV = 'test';

// Connect to the in-memory database
beforeAll(async () => {
  // Close any existing connections
  await mongoose.disconnect();
  
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
}, 30000); // Increase timeout to 30 seconds

// Clear database between tests
beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany();
  }
});

// Disconnect and stop server
afterAll(async () => {
  try {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await mongod.stop();
  } catch (error) {
    console.error('Error in afterAll:', error);
  }
});

// Helper function to generate test JWT tokens
global.generateTestToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

// Helper function to create test user
global.createTestUser = async (User, userData = {}) => {
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

// Helper function to create test book
global.createTestBook = async (Book, bookData = {}) => {
  const defaultBook = {
    title: 'Test Book',
    author: 'Test Author',
    description: 'Test Description',
    price: 19.99,
    category: 'Fiction',
    seller: new mongoose.Types.ObjectId(),
    isbn: '9783161484100',
    isDigital: false,
    isAudiobook: false,
    stock: 10,
    ...bookData
  };
  return await Book.create(defaultBook);
};

// Import and use the Cloudinary mock
jest.mock('cloudinary', () => require('./helpers/cloudinaryMock'));

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue(true)
  })
}));

// Mock environment variables
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRE = '1h';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';
process.env.EMAIL_SERVICE = 'gmail';
process.env.EMAIL_USERNAME = 'test@example.com';
process.env.EMAIL_PASSWORD = 'test-password';
process.env.EMAIL_FROM = 'test@example.com'; 