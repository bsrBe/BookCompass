const request = require('supertest');
const app = require('../../../server');
const { setupTestUser, setupTestBook } = require('../../helpers/testUtils');
const { Wishlist } = require('../../../models/wishlistModel');
const Book = require('../../../models/bookModel');

describe('Wishlist Endpoints', () => {
  let userToken;
  let testBook;
  let testWishlist;

  beforeEach(async () => {
    await Wishlist.deleteMany({});
    await Book.deleteMany({});

    const { token: userT, user } = await setupTestUser();
    const { book } = await setupTestBook();

    userToken = userT;
    testBook = book;

    // Create a test wishlist
    testWishlist = await Wishlist.create({
      user: user._id,
      books: [book._id]
    });
  });

  describe('GET /api/wishlist', () => {
    it('should get user wishlist', async () => {
      const res = await request(app)
        .get('/api/wishlist')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.books).toHaveLength(1);
      expect(res.body.books[0]._id.toString()).toBe(testBook._id.toString());
    });

    it('should not get wishlist without authentication', async () => {
      const res = await request(app)
        .get('/api/wishlist');

      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/wishlist/add/:bookId', () => {
    it('should add book to wishlist', async () => {
      const { book: newBook } = await setupTestBook({ title: 'New Book' });

      const res = await request(app)
        .post(`/api/wishlist/add/${newBook._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.books).toHaveLength(2);
      expect(res.body.books.find(book => book._id.toString() === newBook._id.toString())).toBeDefined();
    });

    it('should not add book that is already in wishlist', async () => {
      const res = await request(app)
        .post(`/api/wishlist/add/${testBook._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('message');
    });

    it('should not add non-existent book', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(`/api/wishlist/add/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/wishlist/remove/:bookId', () => {
    it('should remove book from wishlist', async () => {
      const res = await request(app)
        .delete(`/api/wishlist/remove/${testBook._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.books).toHaveLength(0);
    });

    it('should not remove book that is not in wishlist', async () => {
      const { book: otherBook } = await setupTestBook({ title: 'Other Book' });
      
      const res = await request(app)
        .delete(`/api/wishlist/remove/${otherBook._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('should not remove book without authentication', async () => {
      const res = await request(app)
        .delete(`/api/wishlist/remove/${testBook._id}`);

      expect(res.statusCode).toBe(401);
    });
  });

  describe('DELETE /api/wishlist/clear', () => {
    it('should clear wishlist', async () => {
      // Add another book to wishlist
      const { book: newBook } = await setupTestBook({ title: 'New Book' });
      await request(app)
        .post(`/api/wishlist/add/${newBook._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      const res = await request(app)
        .delete('/api/wishlist/clear')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.books).toHaveLength(0);

      // Verify wishlist is empty in database
      const wishlist = await Wishlist.findOne({ user: testWishlist.user });
      expect(wishlist.books).toHaveLength(0);
    });

    it('should not clear wishlist without authentication', async () => {
      const res = await request(app)
        .delete('/api/wishlist/clear');

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/wishlist/check/:bookId', () => {
    it('should check if book is in wishlist', async () => {
      const res = await request(app)
        .get(`/api/wishlist/check/${testBook._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('inWishlist', true);
    });

    it('should return false for book not in wishlist', async () => {
      const { book: otherBook } = await setupTestBook({ title: 'Other Book' });
      
      const res = await request(app)
        .get(`/api/wishlist/check/${otherBook._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('inWishlist', false);
    });

    it('should not check wishlist without authentication', async () => {
      const res = await request(app)
        .get(`/api/wishlist/check/${testBook._id}`);

      expect(res.statusCode).toBe(401);
    });
  });
}); 