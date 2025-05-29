const request = require('supertest');
const app = require('../../../server');
const { setupTestUser, setupTestBook } = require('../../helpers/testUtils');
const Cart = require('../../../models/cartModel');
const Book = require('../../../models/bookModel');

describe('Cart Endpoints', () => {
  let userToken;
  let testBook;
  let testCart;

  beforeEach(async () => {
    await Cart.deleteMany({});
    await Book.deleteMany({});

    const { token: userT, user } = await setupTestUser();
    const { book } = await setupTestBook({ stock: 10 });

    userToken = userT;
    testBook = book;

    // Create a test cart
    testCart = await Cart.create({
      user: user._id,
      items: [{
        book: book._id,
        quantity: 1
      }]
    });
  });

  describe('GET /api/cart', () => {
    it('should get user cart', async () => {
      const res = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].book._id.toString()).toBe(testBook._id.toString());
    });

    it('should not get cart without authentication', async () => {
      const res = await request(app)
        .get('/api/cart');

      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/cart/add', () => {
    it('should add item to cart', async () => {
      const { book: newBook } = await setupTestBook({ title: 'New Book' });

      const res = await request(app)
        .post('/api/cart/add')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          bookId: newBook._id,
          quantity: 2
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items.find(item => item.book._id.toString() === newBook._id.toString())).toBeDefined();
    });

    it('should update quantity if item already in cart', async () => {
      const res = await request(app)
        .post('/api/cart/add')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          bookId: testBook._id,
          quantity: 3
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].quantity).toBe(4); // 1 + 3
    });

    it('should not add item with invalid quantity', async () => {
      const res = await request(app)
        .post('/api/cart/add')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          bookId: testBook._id,
          quantity: 0
        });

      expect(res.statusCode).toBe(400);
    });

    it('should not add item with quantity exceeding stock', async () => {
      const res = await request(app)
        .post('/api/cart/add')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          bookId: testBook._id,
          quantity: 20 // Only 10 in stock
        });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('PUT /api/cart/update/:itemId', () => {
    it('should update cart item quantity', async () => {
      const itemId = testCart.items[0]._id;

      const res = await request(app)
        .put(`/api/cart/update/${itemId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ quantity: 5 });

      expect(res.statusCode).toBe(200);
      expect(res.body.items[0].quantity).toBe(5);
    });

    it('should not update with invalid quantity', async () => {
      const itemId = testCart.items[0]._id;

      const res = await request(app)
        .put(`/api/cart/update/${itemId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ quantity: -1 });

      expect(res.statusCode).toBe(400);
    });

    it('should not update item from another user cart', async () => {
      const { token: otherUserToken } = await setupTestUser({ email: 'other@example.com' });
      const itemId = testCart.items[0]._id;

      const res = await request(app)
        .put(`/api/cart/update/${itemId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ quantity: 5 });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/cart/remove/:itemId', () => {
    it('should remove item from cart', async () => {
      const itemId = testCart.items[0]._id;

      const res = await request(app)
        .delete(`/api/cart/remove/${itemId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.items).toHaveLength(0);
    });

    it('should not remove item from another user cart', async () => {
      const { token: otherUserToken } = await setupTestUser({ email: 'other@example.com' });
      const itemId = testCart.items[0]._id;

      const res = await request(app)
        .delete(`/api/cart/remove/${itemId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/cart/clear', () => {
    it('should clear user cart', async () => {
      // Add another item to cart
      const { book: newBook } = await setupTestBook({ title: 'New Book' });
      await request(app)
        .post('/api/cart/add')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          bookId: newBook._id,
          quantity: 1
        });

      const res = await request(app)
        .delete('/api/cart/clear')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.items).toHaveLength(0);

      // Verify cart is empty in database
      const cart = await Cart.findOne({ user: testCart.user });
      expect(cart.items).toHaveLength(0);
    });

    it('should not clear cart without authentication', async () => {
      const res = await request(app)
        .delete('/api/cart/clear');

      expect(res.statusCode).toBe(401);
    });
  });
}); 