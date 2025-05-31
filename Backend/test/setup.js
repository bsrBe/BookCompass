const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

let mongod;
let server;

// Set test environment variables
process.env.PORT = 0; // Use random available port
process.env.NODE_ENV = 'test';

// Connect to the in-memory database
beforeAll(async () => {
  try {
    // Close any existing connections
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    
    // Kill any existing mongod processes on the test port
    try {
      execSync('taskkill /F /IM mongod.exe', { stdio: 'ignore' });
    } catch (e) {
      // Ignore errors if no process was found
    }
    
    // Enable debug logging
    process.env.DEBUG = 'mongodb-memory-server:*';
    
    mongod = await MongoMemoryServer.create({
      instance: {
        dbName: 'jest',
        port: 27018, // Use a specific port instead of 0
        version: '4.4.18'
      },
      binary: {
        version: '4.4.18',
        downloadDir: path.join(__dirname, '../node_modules/.cache/mongodb-memory-server'),
        checkMD5: false
      }
    });
    const uri = mongod.getUri();
    
    // Add connection options with increased timeouts
    const options = {
      serverSelectionTimeoutMS: 120000, // 2 minutes
      socketTimeoutMS: 120000, // 2 minutes
      connectTimeoutMS: 120000 // 2 minutes
    };

    await mongoose.connect(uri, options);
  } catch (error) {
    console.error('Error in beforeAll setup:', error);
    throw error;
  }
}, 120000); // Increase timeout to 2 minutes

// Clear database between tests
beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany();
  }
});

// Cleanup after all tests
afterAll(async () => {
  try {
    // Close mongoose connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    
    // Stop the MongoDB memory server
    if (mongod) {
      await mongod.stop({ force: true });
    }
    
    // Kill any remaining mongod processes
    try {
      execSync('taskkill /F /IM mongod.exe', { stdio: 'ignore' });
    } catch (e) {
      // Ignore errors if no process was found
    }
  } catch (error) {
    console.error('Error in afterAll cleanup:', error);
    throw error;
  }
}, 30000); // 30 second timeout for cleanup

// Helper to store server instance
global.setTestServer = (srv) => {
  server = srv;
};

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

// Mock email service
jest.mock('../utils/sendEmail', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
  sendWelcomeEmail: jest.fn().mockResolvedValue({ success: true })
}));

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  })
}));

// Mock JWT
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('test-token'),
  verify: jest.fn().mockReturnValue({ id: 'test-user-id' })
}));

// Mock environment variables
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRE = '1h';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_SECRET_KEY = 'test-secret';
process.env.EMAIL_SERVICE = 'gmail';
process.env.EMAIL_USERNAME = 'test@example.com';
process.env.EMAIL_PASSWORD = 'test-password';
process.env.EMAIL_FROM = 'test@example.com'; 