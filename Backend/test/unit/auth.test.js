const { createTestUser, mockRequest, mockResponse, mockNext } = require('../helpers');
const { protect, authorize } = require('../../middlewares/authMiddleware');
const jwt = require('jsonwebtoken');
const User = require('../../models/userModel');

describe('Authentication Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            headers: {},
            cookies: {}
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        next = jest.fn();
    });

    describe('protect middleware', () => {
        it('should return 401 if no token is provided', async () => {
            await protect(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Not authorized, no token'
            });
        });

        it('should return 401 if token is invalid', async () => {
            req.headers.authorization = 'Bearer invalid-token';
            await protect(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Not authorized, token invalid'
            });
        });

        it('should call next() if token is valid', async () => {
            const user = await User.create({
                name: 'Test User',
                email: `test${Date.now()}@example.com`,
                password: 'password123',
                role: 'buyer'
            });

            const token = jwt.sign(
                { id: user._id },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '1h' }
            );

            req.headers.authorization = `Bearer ${token}`;
            await protect(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(req.user).toBeDefined();
            expect(req.user._id.toString()).toBe(user._id.toString());
        });
    });

    describe('restrictTo middleware', () => {
        it('should return 403 if user role is not allowed', async () => {
            const user = await User.create({
                name: 'Test User',
                email: `test${Date.now()}@example.com`,
                password: 'password123',
                role: 'buyer'
            });

            req.user = user;
            await authorize('admin')(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                message: 'this role buyer is not authorized to access this route'
            });
        });

        it('should call next() if user role is allowed', async () => {
            const user = await User.create({
                name: 'Test User',
                email: `test${Date.now()}@example.com`,
                password: 'password123',
                role: 'admin'
            });

            req.user = user;
            await authorize('admin')(req, res, next);
            expect(next).toHaveBeenCalled();
        });
    });
}); 