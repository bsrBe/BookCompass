const request = require('supertest');
const app = require('../../server');
const mongoose = require('mongoose');
const User = require('../../models/userModel');
const Book = require('../../models/bookModel');
const Order = require('../../models/orderModel');
const Cart = require('../../models/cartModel');
const { Wishlist } = require('../../models/wishlistModel');
const Review = require('../../models/ReviewModel');

describe('End-to-End User Flows', () => {
  let buyerToken;
  let sellerToken;
  let buyer;
  let seller;
  let testBook;

  beforeEach(async () => {
    // Clear all collections
    await Promise.all([
      User.deleteMany({}),
      Book.deleteMany({}),
      Order.deleteMany({}),
      Cart.deleteMany({}),
      Wishlist.deleteMany({}),
      Review.deleteMany({})
    ]);

    // Create test users
    buyer = await User.create({
      name: 'Test Buyer',
      email: 'buyer@example.com',
      password: 'password123',
      role: 'user'
    });

    seller = await User.create({
      name: 'Test Seller',
      email: 'seller@example.com',
      password: 'password123',
      role: 'seller'
    });

    // Generate tokens
    buyerToken = generateTestToken(buyer);
    sellerToken = generateTestToken(seller);

    // Create a test book
    testBook = await Book.create({
      title: 'Test Book',
      author: 'Test Author',
      description: 'Test Description',
      price: 19.99,
      type: 'physical',
      seller: seller._id,
      stock: 10,
      condition: 'new'
    });
  });

  describe('Complete User Shopping Flow', () => {
    it('should complete a full shopping experience', async () => {
      // 1. User browses books
      const browseRes = await request(app)
        .get('/api/books/getPhysicalBooks')
        .query({ page: 1, limit: 10 });

      expect(browseRes.statusCode).toBe(200);
      expect(browseRes.body.books).toHaveLength(1);

      // 2. User views book details
      const bookDetailsRes = await request(app)
        .get(`/api/books/singleBook/${testBook._id}`);

      expect(bookDetailsRes.statusCode).toBe(200);
      expect(bookDetailsRes.body.title).toBe(testBook.title);

      // 3. User adds book to wishlist
      const wishlistRes = await request(app)
        .post(`/api/wishlist/add/${testBook._id}`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(wishlistRes.statusCode).toBe(200);
      expect(wishlistRes.body.books).toHaveLength(1);

      // 4. User adds book to cart
      const cartRes = await request(app)
        .post('/api/cart/add')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          bookId: testBook._id,
          quantity: 2
        });

      expect(cartRes.statusCode).toBe(200);
      expect(cartRes.body.items).toHaveLength(1);
      expect(cartRes.body.items[0].quantity).toBe(2);

      // 5. User creates order
      const orderRes = await request(app)
        .post('/api/orders/create')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{
            book: testBook._id,
            quantity: 2
          }],
          shippingAddress: {
            street: '123 Test St',
            city: 'Test City',
            state: 'Test State',
            zipCode: '12345',
            country: 'Test Country'
          }
        });

      expect(orderRes.statusCode).toBe(201);
      expect(orderRes.body.status).toBe('pending');

      // 6. Seller updates order status
      const updateOrderRes = await request(app)
        .put(`/api/orders/${orderRes.body._id}/status`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ status: 'shipped' });

      expect(updateOrderRes.statusCode).toBe(200);
      expect(updateOrderRes.body.status).toBe('shipped');

      // 7. User adds review
      const reviewRes = await request(app)
        .post(`/api/reviews/${testBook._id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          rating: 5,
          comment: 'Great book!'
        });

      expect(reviewRes.statusCode).toBe(201);
      expect(reviewRes.body.rating).toBe(5);

      // 8. Verify final states
      const finalStates = await Promise.all([
        Book.findById(testBook._id),
        Order.findById(orderRes.body._id),
        Cart.findOne({ user: buyer._id }),
        Wishlist.findOne({ user: buyer._id }),
        Review.findOne({ user: buyer._id, book: testBook._id })
      ]);

      const [finalBook, finalOrder, finalCart, finalWishlist, finalReview] = finalStates;

      // Book stock should be reduced
      expect(finalBook.stock).toBe(8); // 10 - 2
      // Order should be shipped
      expect(finalOrder.status).toBe('shipped');
      // Cart should be empty (cleared after order)
      expect(finalCart.items).toHaveLength(0);
      // Wishlist should still have the book
      expect(finalWishlist.books).toHaveLength(1);
      // Review should be created
      expect(finalReview.rating).toBe(5);
    });
  });

  describe('Seller Book Management Flow', () => {
    it('should complete a full book management experience', async () => {
      // 1. Seller creates a new book
      const createBookRes = await request(app)
        .post('/api/books/createBook')
        .set('Authorization', `Bearer ${sellerToken}`)
        .field('title', 'New Book')
        .field('author', 'New Author')
        .field('description', 'New Description')
        .field('price', 29.99)
        .field('type', 'physical')
        .field('stock', 15)
        .field('condition', 'new')
        .attach('image', 'test/fixtures/test-image.jpg');

      expect(createBookRes.statusCode).toBe(201);
      const newBookId = createBookRes.body._id;

      // 2. Seller updates the book
      const updateBookRes = await request(app)
        .put(`/api/books/updateBook/${newBookId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          price: 24.99,
          stock: 20
        });

      expect(updateBookRes.statusCode).toBe(200);
      expect(updateBookRes.body.price).toBe(24.99);
      expect(updateBookRes.body.stock).toBe(20);

      // 3. Seller views their books
      const sellerBooksRes = await request(app)
        .get('/api/books/seller/books')
        .set('Authorization', `Bearer ${sellerToken}`);

      expect(sellerBooksRes.statusCode).toBe(200);
      expect(sellerBooksRes.body).toHaveLength(2); // Including the test book

      // 4. Seller deletes the book
      const deleteBookRes = await request(app)
        .delete(`/api/books/deleteBook/${newBookId}`)
        .set('Authorization', `Bearer ${sellerToken}`);

      expect(deleteBookRes.statusCode).toBe(200);

      // 5. Verify book is deleted
      const deletedBook = await Book.findById(newBookId);
      expect(deletedBook).toBeNull();
    });
  });

  describe('User Account Management Flow', () => {
    it('should complete a full account management experience', async () => {
      // 1. User updates profile
      const updateProfileRes = await request(app)
        .put('/api/auth/update-profile')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          name: 'Updated Buyer Name',
          email: 'updated.buyer@example.com'
        });

      expect(updateProfileRes.statusCode).toBe(200);
      expect(updateProfileRes.body.name).toBe('Updated Buyer Name');

      // 2. User changes password
      const changePasswordRes = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'newpassword123'
        });

      expect(changePasswordRes.statusCode).toBe(200);

      // 3. User logs out (token invalidation would be handled client-side)
      // 4. User logs in with new password
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'updated.buyer@example.com',
          password: 'newpassword123'
        });

      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.body).toHaveProperty('token');

      // 5. User requests password reset
      const forgotPasswordRes = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'updated.buyer@example.com'
        });

      expect(forgotPasswordRes.statusCode).toBe(200);

      // Get reset token from database
      const user = await User.findOne({ email: 'updated.buyer@example.com' });
      const resetToken = user.resetPasswordToken;

      // 6. User resets password
      const resetPasswordRes = await request(app)
        .put(`/api/auth/reset-password/${resetToken}`)
        .send({
          password: 'finalpassword123'
        });

      expect(resetPasswordRes.statusCode).toBe(200);

      // 7. Verify user can login with new password
      const finalLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'updated.buyer@example.com',
          password: 'finalpassword123'
        });

      expect(finalLoginRes.statusCode).toBe(200);
      expect(finalLoginRes.body).toHaveProperty('token');
    });
  });
}); 