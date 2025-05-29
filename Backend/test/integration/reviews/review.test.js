const request = require('supertest');
const app = require('../../../server');
const { setupTestUser, setupTestBook } = require('../../helpers/testUtils');
const Review = require('../../../models/ReviewModel');
const Book = require('../../../models/bookModel');

describe('Review Endpoints', () => {
  let userToken;
  let sellerToken;
  let testBook;
  let testReview;

  beforeEach(async () => {
    await Review.deleteMany({});
    await Book.deleteMany({});

    const { token: userT, user } = await setupTestUser();
    const { token: sellerT } = await setupTestUser({ email: 'seller@example.com', role: 'seller' });
    const { book } = await setupTestBook();

    userToken = userT;
    sellerToken = sellerT;
    testBook = book;

    // Create a test review
    testReview = await Review.create({
      user: user._id,
      book: book._id,
      rating: 4,
      comment: 'Great book!'
    });
  });

  describe('POST /api/reviews/:bookId', () => {
    it('should create a new review', async () => {
      const { book: newBook } = await setupTestBook({ title: 'New Book' });

      const reviewData = {
        rating: 5,
        comment: 'Excellent book!'
      };

      const res = await request(app)
        .post(`/api/reviews/${newBook._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(reviewData);

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('rating', reviewData.rating);
      expect(res.body).toHaveProperty('comment', reviewData.comment);
      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('book');

      // Verify book's average rating was updated
      const updatedBook = await Book.findById(newBook._id);
      expect(updatedBook.averageRating).toBe(5);
    });

    it('should not create review without authentication', async () => {
      const res = await request(app)
        .post(`/api/reviews/${testBook._id}`)
        .send({
          rating: 4,
          comment: 'Good book'
        });

      expect(res.statusCode).toBe(401);
    });

    it('should not create review with invalid rating', async () => {
      const res = await request(app)
        .post(`/api/reviews/${testBook._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 6, // Invalid rating
          comment: 'Good book'
        });

      expect(res.statusCode).toBe(400);
    });

    it('should not create multiple reviews for same book by same user', async () => {
      const res = await request(app)
        .post(`/api/reviews/${testBook._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          rating: 3,
          comment: 'Another review'
        });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/reviews/book/:bookId', () => {
    it('should get all reviews for a book', async () => {
      // Create another review
      const { token: otherUserToken, user: otherUser } = await setupTestUser({ email: 'other@example.com' });
      await Review.create({
        user: otherUser._id,
        book: testBook._id,
        rating: 5,
        comment: 'Another great review!'
      });

      const res = await request(app)
        .get(`/api/reviews/book/${testBook._id}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty('rating');
      expect(res.body[0]).toHaveProperty('comment');
      expect(res.body[0]).toHaveProperty('user');
    });

    it('should return empty array for book with no reviews', async () => {
      const { book: newBook } = await setupTestBook({ title: 'New Book' });

      const res = await request(app)
        .get(`/api/reviews/book/${newBook._id}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });

  describe('PUT /api/reviews/:reviewId', () => {
    it('should update review', async () => {
      const updateData = {
        rating: 5,
        comment: 'Updated review'
      };

      const res = await request(app)
        .put(`/api/reviews/${testReview._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('rating', updateData.rating);
      expect(res.body).toHaveProperty('comment', updateData.comment);

      // Verify book's average rating was updated
      const updatedBook = await Book.findById(testBook._id);
      expect(updatedBook.averageRating).toBe(5);
    });

    it('should not update review without authentication', async () => {
      const res = await request(app)
        .put(`/api/reviews/${testReview._id}`)
        .send({
          rating: 5,
          comment: 'Updated review'
        });

      expect(res.statusCode).toBe(401);
    });

    it('should not update another user review', async () => {
      const { token: otherUserToken } = await setupTestUser({ email: 'other@example.com' });

      const res = await request(app)
        .put(`/api/reviews/${testReview._id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          rating: 5,
          comment: 'Updated review'
        });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('DELETE /api/reviews/:reviewId', () => {
    it('should delete review', async () => {
      const res = await request(app)
        .delete(`/api/reviews/${testReview._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);

      // Verify review was deleted
      const deletedReview = await Review.findById(testReview._id);
      expect(deletedReview).toBeNull();

      // Verify book's average rating was updated
      const updatedBook = await Book.findById(testBook._id);
      expect(updatedBook.averageRating).toBe(0);
    });

    it('should not delete review without authentication', async () => {
      const res = await request(app)
        .delete(`/api/reviews/${testReview._id}`);

      expect(res.statusCode).toBe(401);
    });

    it('should not delete another user review', async () => {
      const { token: otherUserToken } = await setupTestUser({ email: 'other@example.com' });

      const res = await request(app)
        .delete(`/api/reviews/${testReview._id}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/reviews/user', () => {
    it('should get user reviews', async () => {
      const res = await request(app)
        .get('/api/reviews/user')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toHaveProperty('rating', testReview.rating);
      expect(res.body[0]).toHaveProperty('comment', testReview.comment);
    });

    it('should not get user reviews without authentication', async () => {
      const res = await request(app)
        .get('/api/reviews/user');

      expect(res.statusCode).toBe(401);
    });
  });
}); 