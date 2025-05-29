const tf = require('@tensorflow/tfjs');
const Book = require('../models/bookModel');
const User = require('../models/userModel');

const WEIGHTS = {
  PREFERRED_GENRE: 5,
  VIEWED: 1,
  TIME_SPENT: 0.1,
  RATING: 2,
  RECENCY: 0.1,
};

const calculateRecencyFactor = (timestamp) => {
  const daysAgo = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
  return Math.max(1, 10 - daysAgo * WEIGHTS.RECENCY);
};

class BiLSTMRecommender {
  constructor() {
    this.model = null;
    this.vocabSize = 1000;
    this.embeddingDim = 50;
    this.initialized = false;
    this.encoderMap = new Map();
    this.genreMap = new Map();
    this.initializeModel();
  }

  async initializeModel() {
    try {
      console.log('Initializing Bi-LSTM model');
      const model = tf.sequential();

      model.add(tf.layers.embedding({
        inputDim: this.vocabSize,
        outputDim: this.embeddingDim,
        inputLength: 5,
      }));

      model.add(tf.layers.bidirectional({
        layer: tf.layers.lstm({
          units: 32,
          returnSequences: true,
        }),
        mergeMode: 'concat',
      }));

      model.add(tf.layers.bidirectional({
        layer: tf.layers.lstm({
          units: 32,
          returnSequences: false,
        }),
        mergeMode: 'concat',
      }));

      model.add(tf.layers.dense({
        units: this.vocabSize,
        activation: 'softmax',
      }));

      model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy'],
      });

      this.model = model;
      console.log('Bi-LSTM model initialized');
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing Bi-LSTM model:', error);
    }
  }

  async prepareData(user, allBooks) {
    try {
      console.log('Preparing data for Bi-LSTM model');
      allBooks.forEach((book, index) => {
        this.encoderMap.set(book._id.toString(), index);
      });

      const allGenres = Array.from(new Set(allBooks.map(book => book.category)));
      allGenres.forEach((genre, index) => {
        this.genreMap.set(genre, index);
      });

      const userHistory = [
        ...user.history.viewed.map(view => ({ ...view, type: 'viewed' })),
        ...user.history.rated.map(rate => ({ ...rate, type: 'rated' })),
      ]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 20);

      if (userHistory.length < 5) {
        console.log('Not enough user history for Bi-LSTM model');
        return null;
      }

      const sequences = [];
      const targets = [];

      for (let i = 0; i < userHistory.length - 5; i++) {
        const sequence = userHistory.slice(i, i + 5).map(item => this.encoderMap.get(item.bookId.toString()) || 0);
        const target = this.encoderMap.get(userHistory[i + 5]?.bookId.toString()) || 0;

        sequences.push(sequence);
        targets.push(target);
      }

      if (sequences.length === 0) {
        console.log('No sequences could be generated');
        return null;
      }

      const xTensor = tf.tensor2d(sequences, [sequences.length, 5], 'int32');
      const yTensor = tf.oneHot(tf.tensor1d(targets, 'int32'), this.vocabSize);

      return { xTensor, yTensor };
    } catch (error) {
      console.error('Error preparing data:', error);
      return null;
    }
  }

  async train(user, allBooks) {
    if (!this.initialized || !this.model) {
      await this.initializeModel();
    }

    try {
      console.log('Training Bi-LSTM model');
      const data = await this.prepareData(user, allBooks);
      if (!data) {
        console.log('No training data available');
        return false;
      }

      const { xTensor, yTensor } = data;

      await this.model.fit(xTensor, yTensor, {
        epochs: 10,
        batchSize: 32,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Epoch ${epoch + 1}: loss = ${logs?.loss}, accuracy = ${logs?.acc}`);
          },
        },
      });

      xTensor.dispose();
      yTensor.dispose();

      console.log('Bi-LSTM model trained successfully');
      return true;
    } catch (error) {
      console.error('Error training Bi-LSTM model:', error);
      return false;
    }
  }

  async getRecommendations(user, allBooks, limit) {
    if (!this.initialized || !this.model) {
      console.log('Model not initialized, using fallback');
      return [];
    }

    try {
      console.log('Generating recommendations with Bi-LSTM model');
      const recentInteractions = [
        ...user.history.viewed,
        ...user.history.rated,
      ]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5);

      if (recentInteractions.length < 5) {
        console.log('Not enough recent interactions for prediction');
        return [];
      }

      const inputSequence = recentInteractions.map(item => this.encoderMap.get(item.bookId.toString()) || 0);
      const inputTensor = tf.tensor2d([inputSequence], [1, 5], 'int32');

      const predictions = this.model.predict(inputTensor);
      const predictionData = await predictions.data();

      const scores = [];

      for (let i = 0; i < predictionData.length; i++) {
        const bookId = Array.from(this.encoderMap.entries())
          .find(([_, val]) => val === i)?.[0];

        if (bookId && !recentInteractions.some(item => item.bookId.toString() === bookId)) {
          scores.push({
            bookId,
            score: predictionData[i],
          });
        }
      }

      inputTensor.dispose();
      predictions.dispose();

      return scores
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      console.error('Error generating recommendations with Bi-LSTM:', error);
      return [];
    }
  }
}

const biLSTMRecommender = new BiLSTMRecommender();

exports.getRecommendedBooks = async (req, res) => {
  try {
    const userId = req.user._id;
    const genresQuery = req.query.genres; // Get genres as comma-separated string
    const validGenres = [
      'Fiction', 'Non-Fiction', 'Science', 'History', 'Biography',
      'Children', 'Fantasy', 'Mystery', 'Romance', 'Other'
    ];

    // Parse and validate genres
    if (!genresQuery) {
      return res.status(400).json({
        success: false,
        error: 'At least one genre is required'
      });
    }
    const genres = genresQuery.split(',').map(genre => genre.trim());
    const invalidGenres = genres.filter(genre => !validGenres.includes(genre));
    if (invalidGenres.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid genres: ${invalidGenres.join(', ')}. Must be one of: ${validGenres.join(', ')}`
      });
    }

    const user = await User.findById(userId).populate('history.viewed.bookId history.rated.bookId history.timeSpent.bookId');
    let allBooks = await Book.find({ category: { $in: genres } }); // Filter by multiple genres

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (allBooks.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: `No books found in the selected genres: ${genres.join(', ')}`
      });
    }

    // Map category to genres for compatibility
    const adaptedBooks = allBooks.map(book => ({
      ...book._doc,
      id: book._id.toString(),
      genres: [book.category],
    }));

    const adaptedUser = {
      ...user._doc,
      preferences: {
        genres: user.preferences?.genres || [],
      },
      history: {
        viewed: user.history.viewed.map(view => ({
          bookId: view.bookId._id.toString(),
          timestamp: view.timestamp,
        })),
        rated: user.history.rated.map(rate => ({
          bookId: rate.bookId._id.toString(),
          rating: rate.rating,
          timestamp: rate.timestamp,
        })),
        timeSpent: user.history.timeSpent.map(time => ({
          bookId: time.bookId._id.toString(),
          duration: time.duration,
          timestamp: time.timestamp,
        })),
      },
    };

    let recommendedBooks = [];

    // Try Bi-LSTM recommendations
    if (adaptedUser.history.viewed.length > 5 || adaptedUser.history.rated.length > 5) {
      console.log('Training Bi-LSTM model with user data');
      await biLSTMRecommender.train(adaptedUser, adaptedBooks);
      const modelScores = await biLSTMRecommender.getRecommendations(adaptedUser, adaptedBooks, 10);

      if (modelScores.length > 0) {
        console.log('Using Bi-LSTM recommendations');
        recommendedBooks = modelScores
          .map(score => allBooks.find(book => book._id.toString() === score.bookId))
          .filter(book => book !== undefined);
      }
    }

    // Fallback to traditional scoring if Bi-LSTM fails or lacks data
    if (recommendedBooks.length === 0) {
      console.log('Using traditional recommendation approach');
      const scores = [];

      if (
        adaptedUser.preferences.genres.length === 0 &&
        adaptedUser.history.viewed.length === 0 &&
        adaptedUser.history.rated.length === 0
      ) {
        console.log('User has no history, returning random books');
        const shuffled = [...allBooks].sort(() => 0.5 - Math.random());
        recommendedBooks = shuffled.slice(0, 10);
      } else {
        allBooks.forEach(book => {
          let score = 0;

          // Award points for genre match with user preferences
          if (adaptedUser.preferences.genres.includes(book.category)) {
            score += WEIGHTS.PREFERRED_GENRE;
          }

          const views = adaptedUser.history.viewed.filter(view => view.bookId === book._id.toString());
          views.forEach(view => {
            score += WEIGHTS.VIEWED * calculateRecencyFactor(view.timestamp);
          });

          const timeSpent = adaptedUser.history.timeSpent.find(time => time.bookId === book._id.toString());
          if (timeSpent) {
            const minutesSpent = timeSpent.duration / (1000 * 60);
            score += minutesSpent * WEIGHTS.TIME_SPENT * calculateRecencyFactor(timeSpent.timestamp);
          }

          const rating = adaptedUser.history.rated.find(rated => rated.bookId === book._id.toString());
          if (rating) {
            score += rating.rating * WEIGHTS.RATING * calculateRecencyFactor(rating.timestamp);
          }

          if (rating && rating.rating > 4) {
            score = score * 0.5;
          }

          scores.push({
            bookId: book._id.toString(),
            score,
          });
        });

        const topScores = scores
          .sort((a, b) => b.score - a.score)
          .slice(0, 10);

        recommendedBooks = topScores
          .map(score => allBooks.find(book => book._id.toString() === score.bookId))
          .filter(book => book !== undefined);
      }
    }

    res.status(200).json({
      success: true,
      data: recommendedBooks,
    });
  } catch (error) {
    console.error('Error getting recommended books:', error);
    const allBooks = await Book.find({ category: { $in: req.query.genres.split(',').map(g => g.trim()) } });
    const shuffled = [...allBooks].sort(() => 0.5 - Math.random());
    res.status(200).json({
      success: true,
      data: shuffled.slice(0, 10),
    });
  }
};

// Add functions to record user interactions
exports.recordView = async (req, res) => {
  try {
    const { bookId } = req.body;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({ success: false, error: 'Invalid book ID' });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ success: false, error: 'Book not found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Add view to user history
    user.history.viewed.push({
      bookId,
      timestamp: new Date(),
    });

    await user.save();

    res.status(200).json({ success: true, message: 'View recorded successfully' });
  } catch (error) {
    console.error('Error recording view:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

exports.recordRating = async (req, res) => {
  try {
    const { bookId, rating } = req.body;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({ success: false, error: 'Invalid book ID' });
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: 'Rating must be an integer between 1 and 5' });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ success: false, error: 'Book not found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check if rating exists and update, or add new
    const existingRating = user.history.rated.find(r => r.bookId.toString() === bookId);
    if (existingRating) {
      existingRating.rating = rating;
      existingRating.timestamp = new Date();
    } else {
      user.history.rated.push({
        bookId,
        rating,
        timestamp: new Date(),
      });
    }

    await user.save();

    res.status(200).json({ success: true, message: 'Rating recorded successfully' });
  } catch (error) {
    console.error('Error recording rating:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

exports.recordTimeSpent = async (req, res) => {
  try {
    const { bookId, duration } = req.body;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({ success: false, error: 'Invalid book ID' });
    }

    if (!Number.isInteger(duration) || duration < 0) {
      return res.status(400).json({ success: false, error: 'Duration must be a non-negative integer' });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ success: false, error: 'Book not found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Add or update time spent
    const existingTime = user.history.timeSpent.find(t => t.bookId.toString() === bookId);
    if (existingTime) {
      existingTime.duration += duration;
      existingTime.timestamp = new Date();
    } else {
      user.history.timeSpent.push({
        bookId,
        duration,
        timestamp: new Date(),
      });
    }

    await user.save();

    res.status(200).json({ success: true, message: 'Time spent recorded successfully' });
  } catch (error) {
    console.error('Error recording time spent:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};