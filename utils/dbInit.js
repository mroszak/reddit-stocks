const mongoose = require('mongoose');
const SubredditConfig = require('../models/SubredditConfig');
const RedditPost = require('../models/RedditPost');
const UserProfile = require('../models/UserProfile');
const StockData = require('../models/StockData');

class DatabaseInitializer {
  constructor() {
    this.isInitialized = false;
  }

  // Initialize database with default data
  async initializeDatabase() {
    try {
      console.log('🔄 Initializing database...');

      // Check if database is already initialized
      const existingSubreddits = await SubredditConfig.countDocuments();
      if (existingSubreddits > 0) {
        console.log('✅ Database already initialized');
        this.isInitialized = true;
        return { success: true, message: 'Database already initialized' };
      }

      // Create default subreddit configurations
      await this.createDefaultSubreddits();

      // Create database indexes
      await this.createIndexes();

      // Validate collections
      await this.validateCollections();

      this.isInitialized = true;
      console.log('✅ Database initialization completed successfully');
      
      return { 
        success: true, 
        message: 'Database initialized successfully',
        collections: ['SubredditConfig', 'RedditPost', 'UserProfile', 'StockData']
      };
    } catch (error) {
      console.error('❌ Database initialization failed:', error.message);
      throw error;
    }
  }

  // Create default subreddit configurations
  async createDefaultSubreddits() {
    console.log('📝 Creating default subreddit configurations...');
    
    const defaultSubreddits = SubredditConfig.getDefaultSubreddits();
    const createdSubreddits = [];

    for (const subredditData of defaultSubreddits) {
      try {
        const existingSubreddit = await SubredditConfig.findOne({ name: subredditData.name });
        
        if (!existingSubreddit) {
          const subreddit = new SubredditConfig(subredditData);
          await subreddit.save();
          createdSubreddits.push(subreddit.name);
          console.log(`✅ Created subreddit config: r/${subreddit.name}`);
        } else {
          console.log(`ℹ️ Subreddit config already exists: r/${subredditData.name}`);
        }
      } catch (error) {
        console.error(`❌ Failed to create subreddit config for r/${subredditData.name}:`, error.message);
      }
    }

    console.log(`📊 Created ${createdSubreddits.length} default subreddit configurations`);
    return createdSubreddits;
  }

  // Create database indexes for performance
  async createIndexes() {
    console.log('🔍 Creating database indexes...');

    try {
      // RedditPost indexes
      await RedditPost.collection.createIndex({ reddit_id: 1 }, { unique: true });
      await RedditPost.collection.createIndex({ subreddit: 1, created_utc: -1 });
      await RedditPost.collection.createIndex({ 'tickers.symbol': 1, created_utc: -1 });
      await RedditPost.collection.createIndex({ author: 1, created_utc: -1 });
      await RedditPost.collection.createIndex({ quality_score: -1, sentiment_score: -1 });
      await RedditPost.collection.createIndex({ passes_noise_filter: 1, processed: 1 });
      await RedditPost.collection.createIndex({ collected_at: -1 });

      // SubredditConfig indexes
      await SubredditConfig.collection.createIndex({ name: 1 }, { unique: true });
      await SubredditConfig.collection.createIndex({ is_active: 1, last_scraped: 1 });
      await SubredditConfig.collection.createIndex({ 'performance_metrics.accuracy_rate': -1 });

      // UserProfile indexes
      await UserProfile.collection.createIndex({ username: 1 }, { unique: true });
      await UserProfile.collection.createIndex({ quality_score: -1 });
      await UserProfile.collection.createIndex({ reputation_tier: 1, accuracy_score: -1 });
      await UserProfile.collection.createIndex({ is_bot: 1, is_suspicious: 1 });

      // StockData indexes
      await StockData.collection.createIndex({ ticker: 1 }, { unique: true });
      await StockData.collection.createIndex({ trending_score: -1 });
      await StockData.collection.createIndex({ 'reddit_mentions.last_24h': -1 });
      await StockData.collection.createIndex({ is_trending: 1, momentum_score: -1 });
      await StockData.collection.createIndex({ last_updated: -1 });

      console.log('✅ Database indexes created successfully');
    } catch (error) {
      console.error('❌ Error creating indexes:', error.message);
      throw error;
    }
  }

  // Validate that all collections are properly configured
  async validateCollections() {
    console.log('🔍 Validating database collections...');

    const collections = [
      { name: 'SubredditConfig', model: SubredditConfig },
      { name: 'RedditPost', model: RedditPost },
      { name: 'UserProfile', model: UserProfile },
      { name: 'StockData', model: StockData }
    ];

    for (const collection of collections) {
      try {
        // Test basic operations
        await collection.model.findOne().limit(1);
        
        // Check indexes
        const indexes = await collection.model.collection.getIndexes();
        console.log(`✅ Collection ${collection.name}: ${Object.keys(indexes).length} indexes`);
        
      } catch (error) {
        console.error(`❌ Validation failed for ${collection.name}:`, error.message);
        throw error;
      }
    }

    console.log('✅ All collections validated successfully');
  }

  // Get database statistics
  async getDatabaseStats() {
    try {
      const stats = {
        subreddits: await SubredditConfig.countDocuments(),
        active_subreddits: await SubredditConfig.countDocuments({ is_active: true }),
        reddit_posts: await RedditPost.countDocuments(),
        processed_posts: await RedditPost.countDocuments({ processed: true }),
        user_profiles: await UserProfile.countDocuments(),
        stock_data_entries: await StockData.countDocuments(),
        trending_stocks: await StockData.countDocuments({ is_trending: true })
      };

      // Get recent activity
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      stats.posts_last_24h = await RedditPost.countDocuments({ 
        collected_at: { $gte: cutoffTime } 
      });

      // Get top subreddits by post count
      const topSubreddits = await RedditPost.aggregate([
        { $group: { _id: '$subreddit', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);
      stats.top_subreddits = topSubreddits;

      // Get most mentioned tickers
      const topTickers = await RedditPost.aggregate([
        { $unwind: '$tickers' },
        { $group: { _id: '$tickers.symbol', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);
      stats.top_tickers = topTickers;

      return stats;
    } catch (error) {
      console.error('❌ Error getting database stats:', error.message);
      throw error;
    }
  }

  // Reset database (for development/testing)
  async resetDatabase(confirmationPhrase) {
    if (confirmationPhrase !== 'RESET_REDDIT_STOCKS_DB') {
      throw new Error('Invalid confirmation phrase for database reset');
    }

    try {
      console.log('🔄 Resetting database...');
      
      // Drop all collections
      await RedditPost.deleteMany({});
      await UserProfile.deleteMany({});
      await StockData.deleteMany({});
      await SubredditConfig.deleteMany({});

      console.log('🗑️ All collections cleared');

      // Reinitialize
      await this.initializeDatabase();
      
      console.log('✅ Database reset and reinitialized');
      return { success: true, message: 'Database reset successfully' };
    } catch (error) {
      console.error('❌ Database reset failed:', error.message);
      throw error;
    }
  }

  // Check database health
  async checkHealth() {
    try {
      const health = {
        connection: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        database: mongoose.connection.name,
        collections: {},
        indexes: {},
        timestamp: new Date().toISOString()
      };

      // Check each collection
      const models = [SubredditConfig, RedditPost, UserProfile, StockData];
      
      for (const model of models) {
        const collectionName = model.collection.name;
        
        try {
          // Document count
          health.collections[collectionName] = {
            count: await model.countDocuments(),
            indexes: Object.keys(await model.collection.getIndexes()).length
          };
          
          // Test basic query
          await model.findOne().limit(1);
          health.collections[collectionName].accessible = true;
          
        } catch (error) {
          health.collections[collectionName] = {
            accessible: false,
            error: error.message
          };
        }
      }

      return health;
    } catch (error) {
      return {
        connection: 'Error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Optimize database performance
  async optimizeDatabase() {
    try {
      console.log('🔧 Optimizing database performance...');

      // Clean up old data (older than 30 days)
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const deletedPosts = await RedditPost.deleteMany({
        created_utc: { $lt: cutoffDate },
        quality_score: { $lt: 30 }
      });

      console.log(`🗑️ Cleaned up ${deletedPosts.deletedCount} old low-quality posts`);

      // Update user profiles that haven't been updated recently
      const staleUsers = await UserProfile.find({
        last_updated: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }).limit(100);

      for (const user of staleUsers) {
        user.last_updated = new Date();
        await user.save();
      }

      console.log(`📊 Updated ${staleUsers.length} stale user profiles`);

      // Recalculate subreddit performance metrics
      const activeSubreddits = await SubredditConfig.find({ is_active: true });
      for (const subreddit of activeSubreddits) {
        await subreddit.calculatePerformance();
      }

      console.log(`📈 Updated performance metrics for ${activeSubreddits.length} subreddits`);

      return { 
        success: true, 
        cleaned_posts: deletedPosts.deletedCount,
        updated_users: staleUsers.length,
        updated_subreddits: activeSubreddits.length
      };
    } catch (error) {
      console.error('❌ Database optimization failed:', error.message);
      throw error;
    }
  }
}

module.exports = new DatabaseInitializer();
