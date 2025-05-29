const request = require('supertest');
const app = require('../../../server');
const User = require('../../../models/userModel');

describe('Register Endpoint', () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  it('should register a new user successfully', async () => {
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'buyer'
    };

    const res = await request(app)
      .post('/api/auth/register')
      .send(userData);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toHaveProperty('email', userData.email);
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('should not register user with existing email', async () => {
    // First create a user
    await User.create({
      name: 'Existing User',
      email: 'test@example.com',
      password: 'password123',
      role: 'buyer'
    });

    // Try to register with same email
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'New User',
        email: 'test@example.com',
        password: 'password123',
        role: 'buyer'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should not register user with invalid data', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'invalid-email',
        password: '123', // Too short
        role: 'invalid-role'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
}); 