const mongoose = require('mongoose');
const dbInit = require('../utils/dbInit');
const redditService = require('../services/redditService');
const dataProcessor = require('../services/dataProcessor');
require('dotenv').config();

class StartupManager {
  constructor() {
    this.initializationSteps = [
      { name: 'Database Connection', fn: this.connectDatabase },
      { name: 'Database Initialization', fn: this.initializeDatabase },
      { name: 'Reddit API Authentication', fn: this.authenticateReddit },
      { name: 'Initial Data Processing', fn: this.processInitialData }
    ];
  }

  async startup() {
    console.log('🚀 Starting Reddit Stocks Sentiment Tracker...');
    console.log('📊 Phase 1: Core Data Pipeline');
    console.log('=' .repeat(50));

    try {
      for (const step of this.initializationSteps) {
        console.log(`\n🔄 ${step.name}...`);
        await step.fn.call(this);
        console.log(`✅ ${step.name} completed`);
      }

      console.log('\n' + '='.repeat(50));
      console.log('🎉 Startup completed successfully!');
      console.log('📊 Phase 1 implementation is ready');
      console.log('\n📋 Available Features:');
      console.log('  • Reddit API integration with authentication');
      console.log('  • Automatic ticker extraction from posts');
      console.log('  • AlphaVantage stock price data retrieval');
      console.log('  • MongoDB database with comprehensive schemas');
      console.log('  • Sentiment analysis with keyword-based scoring');
      console.log('  • Noise filtering with quality thresholds');
      console.log('  • Time-decay weighting for posts');
      console.log('  • Real-time data processing pipeline');
      console.log('\n🌐 API Endpoints:');
      console.log('  • GET  /api/health - System health check');
      console.log('  • GET  /api/reddit/trending - Trending stocks');
      console.log('  • GET  /api/reddit/stock/:ticker - Stock discussions');
      console.log('  • POST /api/reddit/process - Manual data processing');
      console.log('  • GET  /api/stocks/prices/:ticker - Stock prices');
      console.log('  • GET  /api/subreddits - Subreddit management');

      return { success: true, message: 'Startup completed successfully' };
    } catch (error) {
      console.error('\n❌ Startup failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async connectDatabase() {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reddit-stocks-tracker';
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`   📦 Connected to MongoDB: ${mongoose.connection.name}`);
  }

  async initializeDatabase() {
    const result = await dbInit.initializeDatabase();
    
    if (result.success) {
      console.log(`   📊 ${result.message}`);
      
      // Get database statistics
      const stats = await dbInit.getDatabaseStats();
      console.log(`   📈 Database Stats:`);
      console.log(`      - Subreddits: ${stats.subreddits} (${stats.active_subreddits} active)`);
      console.log(`      - Reddit Posts: ${stats.reddit_posts} (${stats.processed_posts} processed)`);
      console.log(`      - User Profiles: ${stats.user_profiles}`);
      console.log(`      - Stock Data: ${stats.stock_data_entries}`);
    } else {
      throw new Error(result.message);
    }
  }

  async authenticateReddit() {
    const success = await redditService.initialize();
    
    if (success) {
      const status = redditService.getStatus();
      console.log(`   🔑 Reddit API authenticated successfully`);
      console.log(`   📊 Rate Limit: ${status.requests_made}/${status.max_requests_per_window} requests`);
    } else {
      throw new Error('Reddit API authentication failed');
    }
  }

  async processInitialData(options = {}) {
    const { skipProcessing = false, limit = 10 } = options;
    
    if (skipProcessing) {
      console.log('   ⏭️ Skipping initial data processing');
      return;
    }

    console.log('   🔄 Running initial data processing...');
    
    try {
      const result = await dataProcessor.processRedditData({ limit });
      
      if (result.success) {
        console.log(`   📊 Processing completed:`);
        console.log(`      - Posts processed: ${result.stats.posts_processed}`);
        console.log(`      - Posts filtered: ${result.stats.posts_filtered}`);
        console.log(`      - Tickers extracted: ${result.stats.tickers_extracted}`);
        console.log(`      - Sentiment analyzed: ${result.stats.sentiment_analyzed}`);
        console.log(`      - Processing time: ${result.processing_time_ms}ms`);
        
        if (result.stats.errors > 0) {
          console.log(`      - Errors encountered: ${result.stats.errors}`);
        }
      } else {
        console.log(`   ⚠️ Processing completed with issues: ${result.error}`);
      }
    } catch (error) {
      console.log(`   ⚠️ Initial processing failed: ${error.message}`);
      // Don't throw error - this is not critical for startup
    }
  }

  // Check system health
  async healthCheck() {
    try {
      const health = {
        timestamp: new Date().toISOString(),
        services: {}
      };

      // Database health
      try {
        health.services.database = await dbInit.checkHealth();
      } catch (error) {
        health.services.database = { status: 'error', error: error.message };
      }

      // Reddit API health
      try {
        health.services.reddit_api = redditService.getStatus();
      } catch (error) {
        health.services.reddit_api = { status: 'error', error: error.message };
      }

      // AlphaVantage API health
      try {
        const alphaVantageService = require('../services/alphaVantageService');
        health.services.alphavantage_api = alphaVantageService.getUsageStats();
      } catch (error) {
        health.services.alphavantage_api = { status: 'error', error: error.message };
      }

      // Data processor health
      try {
        health.services.data_processor = dataProcessor.getProcessingStats();
      } catch (error) {
        health.services.data_processor = { status: 'error', error: error.message };
      }

      return health;
    } catch (error) {
      return {
        timestamp: new Date().toISOString(),
        status: 'error',
        error: error.message
      };
    }
  }

  // Graceful shutdown
  async shutdown() {
    console.log('\n🔄 Graceful shutdown initiated...');
    
    try {
      // Close database connection
      await mongoose.connection.close();
      console.log('✅ Database connection closed');
      
      console.log('✅ Shutdown completed successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Shutdown error:', error.message);
      process.exit(1);
    }
  }
}

// Create singleton instance
const startupManager = new StartupManager();

// Handle graceful shutdown
process.on('SIGINT', () => startupManager.shutdown());
process.on('SIGTERM', () => startupManager.shutdown());

module.exports = startupManager;

// Run startup if this file is executed directly
if (require.main === module) {
  startupManager.startup()
    .then(result => {
      if (result.success) {
        console.log('\n✅ Phase 1 is ready for testing!');
        console.log('🔗 Next steps:');
        console.log('  1. Start the server: npm start');
        console.log('  2. Test the health endpoint: GET /api/health');
        console.log('  3. Trigger data processing: POST /api/reddit/process');
        console.log('  4. View trending stocks: GET /api/reddit/trending');
      } else {
        console.error('\n❌ Startup failed, check configuration');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n❌ Startup error:', error.message);
      process.exit(1);
    });
}
