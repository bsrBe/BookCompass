const request = require('supertest');
const app = require('../../../server');
const { setupTestUser, setupTestBook } = require('../../helpers/testUtils');
const Book = require('../../../models/bookModel');
const mongoose = require('mongoose');

describe('Book Endpoints', () => {
  let sellerToken;
  let userToken;
  let testBook;

  beforeEach(async () => {
    await Book.deleteMany({});
    const { token: sellerT, user: seller } = await setupTestUser({ role: 'seller' });
    const { token: userT } = await setupTestUser({ email: 'user@example.com' });
    const { book } = await setupTestBook({ seller: seller._id });
    
    sellerToken = sellerT;
    userToken = userT;
    testBook = book;
  });

  describe('GET /api/books/getPhysicalBooks', () => {
    it('should get all physical books', async () => {
      // Create additional physical books
      await setupTestBook({ title: 'Physical Book 1' });
      await setupTestBook({ title: 'Physical Book 2' });
      await setupTestBook({ title: 'Digital Book', type: 'digital' });

      const res = await request(app)
        .get('/api/books/getPhysicalBooks')
        .query({ page: 1, limit: 10 });

      expect(res.statusCode).toBe(200);
      expect(res.body.books).toHaveLength(3);
      expect(res.body.books.every(book => book.type === 'physical')).toBe(true);
    });

    it('should filter physical books by search query', async () => {
      await setupTestBook({ title: 'Special Book' });
      await setupTestBook({ title: 'Regular Book' });

      const res = await request(app)
        .get('/api/books/getPhysicalBooks')
        .query({ search: 'Special' });

      expect(res.statusCode).toBe(200);
      expect(res.body.books).toHaveLength(1);
      expect(res.body.books[0].title).toBe('Special Book');
    });
  });

  describe('GET /api/books/singleBook/:id', () => {
    it('should get a single book by id', async () => {
      const res = await request(app)
        .get(`/api/books/singleBook/${testBook._id}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('title', testBook.title);
      expect(res.body).toHaveProperty('author', testBook.author);
    });

    it('should return 404 for non-existent book', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/books/singleBook/${fakeId}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/books/createBook', () => {
    it('should create a new book', async () => {
      const bookData = {
        title: 'New Book',
        author: 'New Author',
        description: 'New Description',
        price: 29.99,
        type: 'physical',
        stock: 5,
        condition: 'new'
      };

      const res = await request(app)
        .post('/api/books/createBook')
        .set('Authorization', `Bearer ${sellerToken}`)
        .field('title', bookData.title)
        .field('author', bookData.author)
        .field('description', bookData.description)
        .field('price', bookData.price)
        .field('type', bookData.type)
        .field('stock', bookData.stock)
        .field('condition', bookData.condition)
        .attach('image', 'test/fixtures/test-image.jpg');

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('title', bookData.title);
      expect(res.body).toHaveProperty('imageUrl');
    });

    it('should not create book without authentication', async () => {
      const res = await request(app)
        .post('/api/books/createBook')
        .send({
          title: 'New Book',
          author: 'New Author'
        });

      expect(res.statusCode).toBe(401);
    });

    it('should not create book with user role', async () => {
      const res = await request(app)
        .post('/api/books/createBook')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'New Book',
          author: 'New Author'
        });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('PUT /api/books/updateBook/:id', () => {
    it('should update a book and its stock', async () => {
      const updateData = {
        title: 'Updated Book',
        price: 39.99,
        stock: 15
      };

      const res = await request(app)
        .put(`/api/books/updateBook/${testBook._id}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send(updateData);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('title', updateData.title);
      expect(res.body).toHaveProperty('price', updateData.price);
      expect(res.body).toHaveProperty('stock', updateData.stock);

      // Verify stock update was done through updateStock method
      const updatedBook = await Book.findById(testBook._id);
      const stockUpdateSpy = jest.spyOn(updatedBook, 'updateStock');
      await updatedBook.updateStock(-5);
      expect(stockUpdateSpy).toHaveBeenCalledWith(-5);
      expect(updatedBook.stock).toBe(10); // 15 - 5
    });

    it('should not update stock to negative value', async () => {
      const updateData = {
        stock: -5
      };

      const res = await request(app)
        .put(`/api/books/updateBook/${testBook._id}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send(updateData);

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('message', 'Stock cannot be negative');
    });

    it('should not update digital book stock', async () => {
      // Create a digital book
      const { book: digitalBook } = await setupTestBook({ 
        title: 'Digital Book',
        isDigital: true,
        fileUrl: 'https://example.com/book.pdf'
      });

      const updateData = {
        stock: 10
      };

      const res = await request(app)
        .put(`/api/books/updateBook/${digitalBook._id}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send(updateData);

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('message', 'Cannot update stock for digital books');
    });

    it('should not update book with user role', async () => {
      const res = await request(app)
        .put(`/api/books/updateBook/${testBook._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Updated Book' });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('DELETE /api/books/deleteBook/:id', () => {
    it('should delete a book', async () => {
      const res = await request(app)
        .delete(`/api/books/deleteBook/${testBook._id}`)
        .set('Authorization', `Bearer ${sellerToken}`);

      expect(res.statusCode).toBe(200);

      const deletedBook = await Book.findById(testBook._id);
      expect(deletedBook).toBeNull();
    });

    it('should not delete book with user role', async () => {
      const res = await request(app)
        .delete(`/api/books/deleteBook/${testBook._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/books/most-sold', () => {
    it('should get most sold books', async () => {
      // Create books with different sales counts
      await setupTestBook({ title: 'Best Seller', salesCount: 100 });
      await setupTestBook({ title: 'Average Seller', salesCount: 50 });
      await setupTestBook({ title: 'Low Seller', salesCount: 10 });

      const res = await request(app)
        .get('/api/books/most-sold')
        .query({ limit: 2 });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('Best Seller');
      expect(res.body[1].title).toBe('Average Seller');
    });
  });
}); 