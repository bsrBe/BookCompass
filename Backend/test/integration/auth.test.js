const request = require('supertest');
const app = require('../../server');
const User = require('../../models/userModel');
const { createTestUser } = require('../helpers');

describe('Authentication Endpoints', () => {
    beforeEach(async () => {
        await User.deleteMany({});
    });

    describe('POST /api/auth/register', () => {
        it('should register a new user successfully', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test User',
                    email: 'test@example.com',
                    password: 'password123',
                    role: 'buyer'
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.token).toBeDefined();
            expect(res.body.user).toBeDefined();
            expect(res.body.user.email).toBe('test@example.com');
        });

        it('should return 400 for invalid role', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test User',
                    email: 'test@example.com',
                    password: 'password123',
                    role: 'invalid_role'
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe('Invalid role. Must be one of: buyer, seller, admin');
        });
    });

    describe('POST /api/auth/login', () => {
        beforeEach(async () => {
            await User.create({
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123',
                isEmailConfirmed: true,
                role: 'buyer'
            });
        });

        it('should login successfully with valid credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.token).toBeDefined();
            expect(res.body.user).toBeDefined();
            expect(res.body.user.email).toBe('test@example.com');
        });

        it('should return 401 for invalid credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'wrongpassword'
                });

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe('Invalid credentials');
        });
    });

    describe('POST /api/auth/forgotPassword', () => {
        beforeEach(async () => {
            await User.create({
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123',
                isEmailConfirmed: true,
                role: 'buyer'
            });
        });

        it('should send reset token email for existing user', async () => {
            const res = await request(app)
                .post('/api/auth/forgotPassword')
                .send({
                    email: 'test@example.com'
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Password reset email sent');
        });

        it('should return 404 for non-existent email', async () => {
            const res = await request(app)
                .post('/api/auth/forgotPassword')
                .send({
                    email: 'nonexistent@example.com'
                });

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe('No user found with that email');
        });
    });

    describe('PUT /api/auth/resetPassword/:token', () => {
        let resetToken;
        beforeEach(async () => {
            const user = await User.create({
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123',
                isEmailConfirmed: true,
                role: 'buyer'
            });
            resetToken = user.getResetPasswordToken();
            await user.save({ validateBeforeSave: false });
        });

        it('should reset password with valid token', async () => {
            const res = await request(app)
                .put(`/api/auth/resetPassword/${resetToken}`)
                .send({
                    password: 'newpassword123'
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Password reset successful');
        });

        it('should return 400 for invalid token', async () => {
            const res = await request(app)
                .put('/api/auth/resetPassword/invalidtoken')
                .send({
                    password: 'newpassword123'
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe('Invalid or expired token');
        });
    });
}); 