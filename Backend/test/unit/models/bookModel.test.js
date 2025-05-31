const mongoose = require('mongoose');
const Book = require('../../../models/bookModel');
const BookShop = require('../../../models/bookShopModel');
const User = require('../../../models/userModel');

describe('Book Model Test', () => {
  let testShop;
  let testSeller;

  beforeEach(async () => {
    // Create a test seller
    testSeller = await User.create({
      name: 'Test Seller',
      email: `seller${Date.now()}@example.com`,
      password: 'password123',
      role: 'seller'
    });

    // Create a test shop
    testShop = await BookShop.create({
      name: `Test Shop ${Date.now()}`,
      tagline: 'Test Tagline',
      description: 'Test Description',
      contact: {
        phoneNumber: '+251912345678',
        email: `shop${Date.now()}@example.com`
      },
      location: {
        type: 'Point',
        coordinates: [38.7, 9.0], // Addis Ababa coordinates
        address: 'Test Address'
      },
      seller: testSeller._id
    });
  });

  describe('Book Schema Validation', () => {
    it('should create a physical book successfully with valid data', async () => {
      const bookData = {
        title: 'Test Book',
        author: 'Test Author',
        description: 'Test Description',
        price: 19.99,
        category: 'Fiction',
        seller: testSeller._id,
        shop: testShop._id,
        stock: 10,
        isbn: '9783161484100',
        isDigital: false,
        isAudiobook: false
      };
      const book = await Book.create(bookData);
      expect(book._id).toBeDefined();
      expect(book.title).toBe(bookData.title);
      expect(book.isDigital).toBe(false);
      expect(book.stock).toBe(bookData.stock);
      expect(book.category).toBe(bookData.category);
      expect(book.isbn).toBe(bookData.isbn);
    });

    it('should create a digital book successfully with valid data', async () => {
      const bookData = {
        title: 'Digital Book',
        author: 'Digital Author',
        description: 'Digital Description',
        price: 9.99,
        category: 'Fiction',
        seller: testSeller._id,
        shop: testShop._id,
        isbn: '9783161484100',
        isDigital: true,
        isAudiobook: false,
        fileUrl: 'https://example.com/book.pdf'
      };
      const book = await Book.create(bookData);
      expect(book._id).toBeDefined();
      expect(book.isDigital).toBe(true);
      expect(book.fileUrl).toBe(bookData.fileUrl);
      expect(book.stock).toBeNull();
    });

    it('should create an audiobook successfully with valid data', async () => {
      const bookData = {
        title: 'Audiobook',
        author: 'Audio Author',
        description: 'Audio Description',
        price: 14.99,
        category: 'Fiction',
        seller: testSeller._id,
        shop: testShop._id,
        isbn: '9783161484100',
        isDigital: false,
        isAudiobook: true,
        fileUrl: 'https://example.com/audio.mp3'
      };
      const book = await Book.create(bookData);
      expect(book._id).toBeDefined();
      expect(book.isAudiobook).toBe(true);
      expect(book.fileUrl).toBe(bookData.fileUrl);
      expect(book.stock).toBeNull();
    });

    it('should fail to create book without required fields', async () => {
      const bookData = {
        title: 'Test Book'
        // Missing required fields
      };
      let error;
      try {
        await Book.create(bookData);
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.errors.author).toBeDefined();
      expect(error.errors.price).toBeDefined();
      expect(error.errors.category).toBeDefined();
      expect(error.errors.seller).toBeDefined();
      expect(error.errors.isbn).toBeDefined();
    });

    it('should fail to create physical book without stock', async () => {
      const bookData = {
        title: 'Test Book',
        author: 'Test Author',
        description: 'Test Description',
        price: 19.99,
        category: 'Fiction',
        seller: testSeller._id,
        shop: testShop._id,
        isbn: '9783161484100',
        isDigital: false,
        isAudiobook: false
        // Missing stock
      };
      let error;
      try {
        await Book.create(bookData);
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.errors.stock).toBeDefined();
    });

    it('should fail to create digital book without fileUrl', async () => {
      const bookData = {
        title: 'Digital Book',
        author: 'Digital Author',
        description: 'Digital Description',
        price: 9.99,
        category: 'Fiction',
        seller: testSeller._id,
        shop: testShop._id,
        isbn: '9783161484100',
        isDigital: true,
        isAudiobook: false
        // Missing fileUrl
      };
      let error;
      try {
        await Book.create(bookData);
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.errors.fileUrl).toBeDefined();
    });

    it('should fail to create book with invalid ISBN', async () => {
      const bookData = {
        title: 'Test Book',
        author: 'Test Author',
        description: 'Test Description',
        price: 19.99,
        category: 'Fiction',
        seller: testSeller._id,
        shop: testShop._id,
        stock: 10,
        isbn: 'invalid-isbn',
        isDigital: false,
        isAudiobook: false
      };
      let error;
      try {
        await Book.create(bookData);
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.errors.isbn).toBeDefined();
    });

    it('should fail to create book with invalid category', async () => {
      const bookData = {
        title: 'Test Book',
        author: 'Test Author',
        description: 'Test Description',
        price: 19.99,
        category: 'InvalidCategory',
        seller: testSeller._id,
        shop: testShop._id,
        stock: 10,
        isbn: '9783161484100',
        isDigital: false,
        isAudiobook: false
      };
      let error;
      try {
        await Book.create(bookData);
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.errors.category).toBeDefined();
    });
  });

  describe('Book Model Methods', () => {
    it('should update stock correctly', async () => {
      const book = await Book.create({
        title: 'Test Book',
        author: 'Test Author',
        description: 'Test Description',
        price: 19.99,
        category: 'Fiction',
        seller: testSeller._id,
        shop: testShop._id,
        stock: 10,
        isbn: '9783161484100',
        isDigital: false,
        isAudiobook: false
      });
      
      // Test adding stock
      await book.updateStock(5);
      expect(book.stock).toBe(15); // 10 + 5

      // Test removing stock
      await book.updateStock(-3);
      expect(book.stock).toBe(12); // 15 - 3
    });

    it('should not allow negative stock', async () => {
      const book = await Book.create({
        title: 'Test Book',
        author: 'Test Author',
        description: 'Test Description',
        price: 19.99,
        category: 'Fiction',
        seller: testSeller._id,
        shop: testShop._id,
        stock: 5,
        isbn: '9783161484100',
        isDigital: false,
        isAudiobook: false
      });
      
      let error;
      try {
        await book.updateStock(-10);
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(book.stock).toBe(5); // Stock should remain unchanged
    });

    it('should calculate average rating correctly', async () => {
      const book = await Book.create({
        title: 'Test Book',
        author: 'Test Author',
        description: 'Test Description',
        price: 19.99,
        category: 'Fiction',
        seller: testSeller._id,
        shop: testShop._id,
        stock: 10,
        isbn: '9783161484100',
        isDigital: false,
        isAudiobook: false
      });

      book.reviews = [
        { rating: 4, user: new mongoose.Types.ObjectId() },
        { rating: 5, user: new mongoose.Types.ObjectId() },
        { rating: 3, user: new mongoose.Types.ObjectId() }
      ];
      await book.save();

      expect(book.averageRating).toBe(4);
    });

    it('should update sales count correctly', async () => {
      const book = await Book.create({
        title: 'Test Book',
        author: 'Test Author',
        description: 'Test Description',
        price: 19.99,
        category: 'Fiction',
        seller: testSeller._id,
        shop: testShop._id,
        stock: 10,
        isbn: '9783161484100',
        isDigital: false,
        isAudiobook: false
      });
      
      await book.incrementSales(3);
      expect(book.salesCount).toBe(3);

      await book.incrementSales(2);
      expect(book.salesCount).toBe(5);
    });
  });

  describe('Book Model Virtuals', () => {
    it('should calculate isAvailable correctly', async () => {
      const book = await Book.create({
        title: 'Test Book',
        author: 'Test Author',
        description: 'Test Description',
        price: 19.99,
        category: 'Fiction',
        seller: testSeller._id,
        shop: testShop._id,
        stock: 5,
        isbn: '9783161484100',
        isDigital: false,
        isAudiobook: false
      });
      expect(book.isAvailable).toBe(true);

      book.stock = 0;
      await book.save();
      expect(book.isAvailable).toBe(false);
    });

    it('should calculate formattedPrice correctly', async () => {
      const book = await Book.create({
        title: 'Test Book',
        author: 'Test Author',
        description: 'Test Description',
        price: 19.99,
        category: 'Fiction',
        seller: testSeller._id,
        shop: testShop._id,
        stock: 10,
        isbn: '9783161484100',
        isDigital: false,
        isAudiobook: false
      });
      expect(book.formattedPrice).toBe('$19.99');
    });
  });

  describe('Book Model Indexes', () => {
    it('should have text search indexes', async () => {
      const indexes = await Book.collection.indexes();
      const textIndexes = indexes.filter(index => index.text);
      expect(textIndexes.length).toBeGreaterThan(0);
    });
  });
}); 