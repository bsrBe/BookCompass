const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

// Generate JWT token for testing
exports.generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    });
};

// Create a test user
exports.createTestUser = async (userData = {}) => {
    const defaultUser = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Test@123',
        role: 'buyer',
        ...userData
    };
    return await User.create(defaultUser);
};

// Create a test admin user
exports.createTestAdmin = async () => {
    return await this.createTestUser('admin');
};

// Mock request object
exports.mockRequest = (data = {}) => {
    return {
        headers: {},
        cookies: {},
        body: {},
        params: {},
        query: {},
        user: null,
        ...data
    };
};

// Mock response object
exports.mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
};

// Mock next function
exports.mockNext = () => jest.fn();

// Mock Cloudinary upload
exports.mockCloudinaryUpload = () => {
    return {
        secure_url: 'https://res.cloudinary.com/test/image/upload/test.jpg',
        public_id: 'test'
    };
};

// Mock Cloudinary delete
exports.mockCloudinaryDelete = () => {
    return { result: 'ok' };
};

// Mock email service
exports.mockEmailService = () => {
    return {
        sendMail: jest.fn().mockResolvedValue({ messageId: 'test' })
    };
};

// Mock payment service
exports.mockPaymentService = () => {
    return {
        createPayment: jest.fn().mockResolvedValue({ id: 'test-payment' }),
        verifyPayment: jest.fn().mockResolvedValue({ status: 'success' })
    };
}; 