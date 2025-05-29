const { createTestUser, mockRequest, mockResponse, mockNext } = require('../helpers');
const { protect, authorize } = require('../../middlewares/authMiddleware');
const jwt = require('jsonwebtoken');

describe('Authentication Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = mockRequest();
        res = mockResponse();
        next = mockNext();
    });

    describe('protect middleware', () => {
        it('should return 401 if no token is provided', async () => {
            await protect(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Not authorized to access this route'
            });
        });

        it('should return 401 if token is invalid', async () => {
            req.headers = { authorization: 'Bearer invalid-token' };
            await protect(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Not authorized to access this route'
            });
        });

        it('should call next() if token is valid', async () => {
            const user = await createTestUser();
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
                expiresIn: process.env.JWT_EXPIRE
            });
            req.headers = { authorization: `Bearer ${token}` };
            await protect(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(req.user).toBeDefined();
            expect(req.user._id.toString()).toBe(user._id.toString());
        });
    });

    describe('restrictTo middleware', () => {
        it('should return 403 if user role is not allowed', async () => {
            const user = await createTestUser({ role: 'buyer' });
            req.user = user;
            await authorize('admin')(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'User role buyer is not authorized to access this route'
            });
        });

        it('should call next() if user role is allowed', async () => {
            const admin = await createTestUser({ role: 'admin' });
            req.user = admin;
            await authorize('admin')(req, res, next);
            expect(next).toHaveBeenCalled();
        });
    });
}); 