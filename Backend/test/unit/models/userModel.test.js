const mongoose = require('mongoose');
const User = require('../../../models/userModel');
const bcrypt = require('bcryptjs');

describe('User Model Test', () => {
  describe('User Schema Validation', () => {
    it('should create a user successfully with valid data', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'buyer'
      };
      const user = await User.create(userData);
      expect(user._id).toBeDefined();
      expect(user.name).toBe(userData.name);
      expect(user.email).toBe(userData.email);
      expect(user.role).toBe(userData.role);
      expect(user.password).not.toBe(userData.password); // Password should be hashed
    });

    it('should fail to create user without required fields', async () => {
      const userData = {
        name: 'John Doe'
        // Missing email and password
      };
      let error;
      try {
        await User.create(userData);
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.errors.email).toBeDefined();
      expect(error.errors.password).toBeDefined();
    });

    it('should fail to create user with invalid email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'invalid-email',
        password: 'password123'
      };
      let error;
      try {
        await User.create(userData);
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.errors.email).toBeDefined();
    });

    it('should fail to create user with invalid role', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'invalid-role'
      };
      let error;
      try {
        await User.create(userData);
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.errors.role).toBeDefined();
    });
  });

  describe('User Model Methods', () => {
    it('should correctly compare password', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'buyer'
      };
      const user = await User.create(userData);
      
      const isMatch = await user.matchPassword('password123');
      expect(isMatch).toBe(true);

      const isNotMatch = await user.matchPassword('wrongpassword');
      expect(isNotMatch).toBe(false);
    });

    it('should generate reset password token', async () => {
      const user = await createTestUser(User);
      const resetToken = user.getResetPasswordToken();
      
      expect(resetToken).toBeDefined();
      expect(user.resetPasswordToken).toBeDefined();
      expect(user.resetPasswordExpire).toBeDefined();
    });

    it('should remove sensitive fields when converted to JSON', async () => {
      const user = await createTestUser(User);
      const userJson = user.toJSON();
      
      expect(userJson.password).toBeUndefined();
      expect(userJson.resetPasswordToken).toBeUndefined();
      expect(userJson.resetPasswordExpire).toBeUndefined();
    });
  });

  describe('User Model Pre-save Middleware', () => {
    it('should hash password before saving', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'buyer'
      };
      const user = await User.create(userData);
      
      const isMatch = await bcrypt.compare('password123', user.password);
      expect(isMatch).toBe(true);
    });

    it('should not hash password if not modified', async () => {
      const user = await createTestUser(User);
      const originalPassword = user.password;
      
      user.name = 'New Name';
      await user.save();
      
      expect(user.password).toBe(originalPassword);
    });
  });
}); 