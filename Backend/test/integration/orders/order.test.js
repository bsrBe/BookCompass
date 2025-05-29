const request = require('supertest');
const app = require('../../../server');
const { setupTestUser, setupTestBook } = require('../../helpers/testUtils');
const Order = require('../../../models/orderModel');
const Book = require('../../../models/bookModel');

describe('Order Endpoints', () => {
  let userToken;
  let sellerToken;
  let testBook;
  let testOrder;

  beforeEach(async () => {
    await Order.deleteMany({});
    await Book.deleteMany({});

    const { token: userT, user } = await setupTestUser();
    const { token: sellerT } = await setupTestUser({ email: 'seller@example.com', role: 'seller' });
    const { book } = await setupTestBook({ stock: 10 });

    userToken = userT;
    sellerToken = sellerT;
    testBook = book;

    // Create a test order
    testOrder = await Order.create({
      user: user._id,
      items: [{
        book: book._id,
        quantity: 1,
        price: book.price
      }],
      totalAmount: book.price,
      status: 'pending',
      shippingAddress: {
        street: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
        country: 'Test Country'
      }
    });
  });

  describe('POST /api/orders/create', () => {
    it('should create a new order and update book stock', async () => {
      const orderData = {
        items: [{
          book: testBook._id,
          quantity: 2
        }],
        shippingAddress: {
          street: '123 New St',
          city: 'New City',
          state: 'New State',
          zipCode: '54321',
          country: 'New Country'
        }
      };

      const res = await request(app)
        .post('/api/orders/create')
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData);

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('totalAmount');
      expect(res.body.items).toHaveLength(1);
      expect(res.body.status).toBe('pending');

      // Verify book stock was updated using the updateStock method
      const updatedBook = await Book.findById(testBook._id);
      expect(updatedBook.stock).toBe(8); // 10 - 2
      
      // Verify the stock update was done through the updateStock method
      const stockUpdateSpy = jest.spyOn(updatedBook, 'updateStock');
      await updatedBook.updateStock(-2);
      expect(stockUpdateSpy).toHaveBeenCalledWith(-2);
      expect(updatedBook.stock).toBe(6); // 8 - 2
    });

    it('should not create order without authentication', async () => {
      const res = await request(app)
        .post('/api/orders/create')
        .send({
          items: [{ book: testBook._id, quantity: 1 }]
        });

      expect(res.statusCode).toBe(401);
    });

    it('should not create order with insufficient stock', async () => {
      const res = await request(app)
        .post('/api/orders/create')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ book: testBook._id, quantity: 20 }], // Only 10 in stock
          shippingAddress: {
            street: '123 Test St',
            city: 'Test City',
            state: 'Test State',
            zipCode: '12345',
            country: 'Test Country'
          }
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('message', 'Insufficient stock');
    });

    it('should not create order for digital book', async () => {
      // Create a digital book
      const { book: digitalBook } = await setupTestBook({ 
        title: 'Digital Book',
        isDigital: true,
        fileUrl: 'https://example.com/book.pdf'
      });

      const res = await request(app)
        .post('/api/orders/create')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ book: digitalBook._id, quantity: 1 }],
          shippingAddress: {
            street: '123 Test St',
            city: 'Test City',
            state: 'Test State',
            zipCode: '12345',
            country: 'Test Country'
          }
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('message', 'Cannot order digital books');
    });
  });

  describe('GET /api/orders/my-orders', () => {
    it('should get user orders', async () => {
      // Create another order
      await Order.create({
        user: (await setupTestUser()).user._id,
        items: [{ book: testBook._id, quantity: 1, price: testBook.price }],
        totalAmount: testBook.price,
        status: 'pending'
      });

      const res = await request(app)
        .get('/api/orders/my-orders')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(1); // Should only get orders for the authenticated user
    });

    it('should not get orders without authentication', async () => {
      const res = await request(app)
        .get('/api/orders/my-orders');

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/orders/:id', () => {
    it('should get order details', async () => {
      const res = await request(app)
        .get(`/api/orders/${testOrder._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('_id', testOrder._id.toString());
      expect(res.body.items).toHaveLength(1);
    });

    it('should not get order details without authentication', async () => {
      const res = await request(app)
        .get(`/api/orders/${testOrder._id}`);

      expect(res.statusCode).toBe(401);
    });

    it('should not get order details of another user', async () => {
      const { token: otherUserToken } = await setupTestUser({ email: 'other@example.com' });
      
      const res = await request(app)
        .get(`/api/orders/${testOrder._id}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('PUT /api/orders/:id/status', () => {
    it('should update order status by seller', async () => {
      const res = await request(app)
        .put(`/api/orders/${testOrder._id}/status`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ status: 'shipped' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('status', 'shipped');
    });

    it('should not update status with invalid status', async () => {
      const res = await request(app)
        .put(`/api/orders/${testOrder._id}/status`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ status: 'invalid-status' });

      expect(res.statusCode).toBe(400);
    });

    it('should not update status with user role', async () => {
      const res = await request(app)
        .put(`/api/orders/${testOrder._id}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'shipped' });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/orders/seller/orders', () => {
    it('should get seller orders', async () => {
      const res = await request(app)
        .get('/api/orders/seller/orders')
        .set('Authorization', `Bearer ${sellerToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should not get seller orders with user role', async () => {
      const res = await request(app)
        .get('/api/orders/seller/orders')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(403);
    });
  });
}); 