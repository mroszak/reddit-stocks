const RedditPost = require('../models/RedditPost');
const UserProfile = require('../models/UserProfile');
const StockData = require('../models/StockData');
const SubredditConfig = require('../models/SubredditConfig');
const tickerExtractor = require('../utils/tickerExtractor');
const sentimentAnalyzer = require('../utils/sentimentAnalyzer');
const redditService = require('./redditService');

class DataProcessor {
  constructor() {
    this.isProcessing = false;
    this.processingStats = {
      posts_processed: 0,
      posts_filtered: 0,
      tickers_extracted: 0,
      sentiment_analyzed: 0,
      errors: 0,
      last_run: null
    };
  }

  // Main processing pipeline
  async processRedditData(options = {}) {
    if (this.isProcessing) {
      console.log('⏳ Data processing already in progress');
      return { success: false, message: 'Processing already in progress' };
    }

    this.isProcessing = true;
    const startTime = Date.now();
    
    try {
      console.log('🔄 Starting Reddit data processing pipeline...');
      
      // Reset stats
      this.processingStats = {
        posts_processed: 0,
        posts_filtered: 0,
        tickers_extracted: 0,
        sentiment_analyzed: 0,
        errors: 0,
        last_run: new Date()
      };

      // Get active subreddit configurations
      const activeSubreddits = await SubredditConfig.find({ is_active: true });
      console.log(`📊 Processing ${activeSubreddits.length} active subreddits`);

      // Process each subreddit
      for (const subredditConfig of activeSubreddits) {
        try {
          await this.processSubreddit(subredditConfig, options);
        } catch (error) {
          console.error(`❌ Error processing r/${subredditConfig.name}:`, error.message);
          this.processingStats.errors++;
        }
      }

      // Update stock data aggregations
      await this.updateStockDataAggregations();

      // Calculate time decay for all posts
      await this.updateTimeDecayFactors();

      const processingTime = Date.now() - startTime;
      console.log(`✅ Data processing completed in ${processingTime}ms`);
      console.log(`📊 Stats:`, this.processingStats);

      return {
        success: true,
        processing_time_ms: processingTime,
        stats: this.processingStats
      };

    } catch (error) {
      console.error('❌ Data processing pipeline failed:', error.message);
      return {
        success: false,
        error: error.message,
        stats: this.processingStats
      };
    } finally {
      this.isProcessing = false;
    }
  }

  // Process a single subreddit
  async processSubreddit(subredditConfig, options = {}) {
    const { limit = 50, sortBy = 'hot' } = options;
    
    console.log(`📥 Processing r/${subredditConfig.name}...`);

    // Check if subreddit can be scraped (rate limiting)
    if (!subredditConfig.canScrape()) {
      console.log(`⏭️ Skipping r/${subredditConfig.name} - rate limited`);
      return;
    }

    try {
      // Fetch posts from Reddit
      const posts = await redditService.getSubredditPosts(subredditConfig.name, {
        sort: sortBy,
        limit: limit,
        minUpvotes: subredditConfig.config.min_upvotes,
        minComments: subredditConfig.config.min_comments
      });

      // Update rate limiting
      subredditConfig.updateRateLimit();
      subredditConfig.last_scraped = new Date();
      await subredditConfig.save();

      // Process each post
      for (const postData of posts) {
        try {
          await this.processPost(postData, subredditConfig);
          this.processingStats.posts_processed++;
        } catch (error) {
          console.error(`❌ Error processing post ${postData.reddit_id}:`, error.message);
          this.processingStats.errors++;
        }
      }

      console.log(`✅ Processed ${posts.length} posts from r/${subredditConfig.name}`);

    } catch (error) {
      console.error(`❌ Error fetching posts from r/${subredditConfig.name}:`, error.message);
      throw error;
    }
  }

  // Process a single Reddit post
  async processPost(postData, subredditConfig) {
    // Check if post already exists
    const existingPost = await RedditPost.findOne({ reddit_id: postData.reddit_id });
    if (existingPost) {
      return; // Skip already processed posts
    }

    // Extract tickers from post
    const tickers = tickerExtractor.extractTickers(postData.content, postData.title);
    if (tickers.length === 0) {
      return; // Skip posts without ticker mentions
    }
    this.processingStats.tickers_extracted += tickers.length;

    // Analyze sentiment
    const sentiment = sentimentAnalyzer.analyzeSentiment(postData.content, postData.title);
    this.processingStats.sentiment_analyzed++;

    // Get or create user profile
    const userProfile = await this.getOrCreateUserProfile(postData.author);

    // Calculate post quality score
    const qualityScore = this.calculatePostQuality(postData, userProfile, subredditConfig);

    // Apply noise filter
    const passesNoiseFilter = this.applyNoiseFilter(postData, qualityScore, subredditConfig);
    if (!passesNoiseFilter) {
      this.processingStats.posts_filtered++;
    }

    // Create the post document
    const redditPost = new RedditPost({
      ...postData,
      tickers: tickers,
      sentiment_score: sentiment.score,
      sentiment_confidence: sentiment.confidence,
      sentiment_keywords: sentiment.details.sentiment_words.slice(0, 10), // Keep top 10
      quality_score: qualityScore,
      user_quality_score: userProfile.quality_score,
      passes_noise_filter: passesNoiseFilter,
      processed: true
    });

    // Calculate time decay factor
    redditPost.updateTimeDecay();

    // Check noise filter with current settings
    redditPost.checkNoiseFilter(
      subredditConfig.config.min_upvotes,
      subredditConfig.config.min_comments
    );

    // Save the post
    await redditPost.save();

    // Update user profile with this post
    await this.updateUserProfile(userProfile, redditPost);

    // Update stock data for each ticker
    for (const ticker of tickers) {
      await this.updateStockData(ticker.symbol, redditPost);
    }
  }

  // Get or create user profile
  async getOrCreateUserProfile(username) {
    let userProfile = await UserProfile.findOne({ username });
    
    if (!userProfile) {
      // Fetch user info from Reddit API
      const userInfo = await redditService.getUserInfo(username);
      
      if (userInfo) {
        userProfile = new UserProfile({
          username: userInfo.username,
          account_age: userInfo.account_age,
          karma: userInfo.karma,
          comment_karma: userInfo.comment_karma,
          link_karma: userInfo.link_karma
        });
      } else {
        // Create minimal profile if Reddit API fails
        userProfile = new UserProfile({
          username: username,
          account_age: 30, // Default assumption
          karma: 100 // Default assumption
        });
      }
      
      await userProfile.save();
    }

    return userProfile;
  }

  // Calculate post quality score
  calculatePostQuality(postData, userProfile, subredditConfig) {
    // Base quality factors
    const upvoteRatio = postData.upvote_ratio || 0.5;
    const upvoteScore = Math.min(100, (postData.upvotes / Math.max(1, subredditConfig.config.min_upvotes)) * 25);
    const commentEngagement = Math.min(100, (postData.comments / Math.max(1, subredditConfig.config.min_comments)) * 25);
    const userQuality = userProfile.quality_score;
    
    // Content depth analysis
    const contentLength = (postData.title.length + postData.content.length);
    const contentDepth = Math.min(100, contentLength / 10); // 1 point per 10 characters, max 100
    
    // Awards bonus
    const awardsBonus = Math.min(20, postData.awards * 5); // 5 points per award, max 20
    
    // Calculate quality score using architecture formula
    const qualityScore = (
      upvoteScore * 0.25 +
      commentEngagement * 0.25 +
      userQuality * 0.3 +
      contentDepth * 0.15 +
      awardsBonus * 0.05
    );

    return Math.max(0, Math.min(100, qualityScore));
  }

  // Apply noise filtering
  applyNoiseFilter(postData, qualityScore, subredditConfig) {
    const config = subredditConfig.config;
    
    // Basic thresholds
    if (postData.upvotes < config.min_upvotes) return false;
    if (postData.comments < config.min_comments) return false;
    if (qualityScore < config.quality_threshold) return false;
    
    // Check for excluded flairs
    if (config.exclude_flairs && config.exclude_flairs.length > 0) {
      const postFlair = (postData.author_flair || '').toLowerCase();
      if (config.exclude_flairs.some(flair => postFlair.includes(flair))) {
        return false;
      }
    }
    
    // Check content length (avoid very short posts)
    const totalLength = postData.title.length + postData.content.length;
    if (totalLength < 50) return false;
    
    // Check for spam patterns (repetitive content)
    if (this.detectSpamPatterns(postData)) return false;
    
    // Velocity check - posts that appear too frequently might be spam
    if (this.detectSuspiciousVelocity(postData, subredditConfig)) return false;
    
    return true;
  }

  // Detect spam patterns
  detectSpamPatterns(postData) {
    const text = (postData.title + ' ' + postData.content).toLowerCase();
    
    // Check for excessive repetition
    const words = text.split(/\s+/);
    const wordCount = {};
    let maxRepeats = 0;
    
    for (const word of words) {
      if (word.length > 3) { // Only check meaningful words
        wordCount[word] = (wordCount[word] || 0) + 1;
        maxRepeats = Math.max(maxRepeats, wordCount[word]);
      }
    }
    
    // If any word repeats more than 30% of total words, likely spam
    if (maxRepeats > words.length * 0.3) return true;
    
    // Check for excessive caps
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (capsRatio > 0.5 && text.length > 20) return true;
    
    // Check for excessive emojis
    const emojiCount = (text.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu) || []).length;
    if (emojiCount > words.length * 0.2) return true;
    
    return false;
  }

  // Detect suspicious velocity (too many posts too quickly)
  async detectSuspiciousVelocity(postData, subredditConfig) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    // Check posts from same author in last hour
    const recentPostsByAuthor = await RedditPost.countDocuments({
      author: postData.author,
      subreddit: subredditConfig.name,
      created_utc: { $gte: oneHourAgo }
    });
    
    // Flag if user posted more than 5 times in an hour in same subreddit
    if (recentPostsByAuthor > 5) return true;
    
    // Check total posts in subreddit in last hour
    const totalRecentPosts = await RedditPost.countDocuments({
      subreddit: subredditConfig.name,
      created_utc: { $gte: oneHourAgo }
    });
    
    // Flag if subreddit exceeded configured hourly limit
    if (totalRecentPosts > subredditConfig.config.max_posts_per_hour) return true;
    
    return false;
  }

  // Update user profile with new post data
  async updateUserProfile(userProfile, redditPost) {
    userProfile.post_count++;
    userProfile.finance_post_count++;
    userProfile.last_post_analyzed = redditPost.created_utc;
    
    // Update average metrics
    const alpha = 0.1; // Exponential moving average factor
    userProfile.avg_upvotes = userProfile.avg_upvotes * (1 - alpha) + redditPost.upvotes * alpha;
    userProfile.avg_comments = userProfile.avg_comments * (1 - alpha) + redditPost.comments * alpha;
    userProfile.awards_received += redditPost.awards;
    
    // Recalculate quality score (handled by pre-save middleware)
    await userProfile.save();
  }

  // Update stock data aggregations
  async updateStockData(ticker, redditPost) {
    let stockData = await StockData.findOne({ ticker: ticker.toUpperCase() });
    
    if (!stockData) {
      stockData = new StockData({
        ticker: ticker.toUpperCase(),
        company_name: '', // Will be populated by AlphaVantage later
      });
    }
    
    // Update Reddit mentions
    stockData.reddit_mentions.total++;
    
    // Check if post is from last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (redditPost.created_utc >= yesterday) {
      stockData.reddit_mentions.last_24h++;
    }
    
    // Check if post is from last 7 days
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (redditPost.created_utc >= lastWeek) {
      stockData.reddit_mentions.last_7d++;
    }
    
    // Update sentiment (weighted by quality and time decay)
    const weight = redditPost.quality_score * redditPost.time_decay_factor / 100;
    const currentWeight = stockData.sentiment_trend.confidence || 0.1;
    const newWeight = currentWeight + weight;
    
    stockData.sentiment_trend.current = (
      (stockData.sentiment_trend.current * currentWeight + redditPost.sentiment_score * weight) / newWeight
    );
    stockData.sentiment_trend.confidence = Math.min(1, newWeight / 10); // Max confidence at weight 10
    
    // Update quality mentions
    if (redditPost.quality_score > 60) {
      stockData.quality_mentions++;
    }
    
    // Update subreddit mentions
    const subredditMention = stockData.subreddit_mentions.find(s => s.subreddit === redditPost.subreddit);
    if (subredditMention) {
      subredditMention.mentions++;
      subredditMention.sentiment = (subredditMention.sentiment + redditPost.sentiment_score) / 2;
    } else {
      stockData.subreddit_mentions.push({
        subreddit: redditPost.subreddit,
        mentions: 1,
        sentiment: redditPost.sentiment_score
      });
    }
    
    stockData.last_reddit_update = new Date();
    
    // Calculate trending and momentum scores (handled by pre-save middleware)
    await stockData.save();
  }

  // Update stock data aggregations for all stocks
  async updateStockDataAggregations() {
    console.log('📊 Updating stock data aggregations...');
    
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Get all unique tickers from recent posts
    const recentTickers = await RedditPost.aggregate([
      { $match: { created_utc: { $gte: cutoff7d }, processed: true } },
      { $unwind: '$tickers' },
      { $group: { _id: '$tickers.symbol' } }
    ]);
    
    for (const tickerGroup of recentTickers) {
      const ticker = tickerGroup._id;
      
      // Skip if no ticker symbol
      if (!ticker) {
        console.warn('⚠️ Skipping ticker group with no _id:', tickerGroup);
        continue;
      }
      
      try {
        // Recalculate mentions for last 24h and 7d
        const mentions24h = await RedditPost.countDocuments({
          'tickers.symbol': ticker,
          created_utc: { $gte: cutoff24h },
          processed: true
        });
        
        const mentions7d = await RedditPost.countDocuments({
          'tickers.symbol': ticker,
          created_utc: { $gte: cutoff7d },
          processed: true
        });
        
        await StockData.updateOne(
          { ticker: ticker },
          {
            $set: {
              'reddit_mentions.last_24h': mentions24h,
              'reddit_mentions.last_7d': mentions7d
            }
          },
          { upsert: true }
        );
        
      } catch (error) {
        console.error(`❌ Error updating aggregations for ${ticker}:`, error.message);
      }
    }
    
    console.log(`✅ Updated aggregations for ${recentTickers.length} tickers`);
  }

  // Update time decay factors for all posts
  async updateTimeDecayFactors() {
    console.log('⏰ Updating time decay factors...');
    
    const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
    
    const recentPosts = await RedditPost.find({
      created_utc: { $gte: cutoffTime },
      processed: true
    });
    
    let updatedCount = 0;
    
    for (const post of recentPosts) {
      const oldDecayFactor = post.time_decay_factor;
      const newDecayFactor = post.updateTimeDecay();
      
      if (Math.abs(oldDecayFactor - newDecayFactor) > 0.01) { // Only update if significant change
        await post.save();
        updatedCount++;
      }
    }
    
    console.log(`✅ Updated time decay for ${updatedCount} posts`);
  }

  // Get processing statistics
  getProcessingStats() {
    return {
      ...this.processingStats,
      is_processing: this.isProcessing
    };
  }

  // Manual cleanup of old data
  async cleanupOldData(options = {}) {
    const { daysToKeep = 30, dryRun = false } = options;
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    console.log(`🧹 Cleaning up data older than ${daysToKeep} days (${cutoffDate})...`);
    
    try {
      // Find old posts with low quality scores
      const query = {
        created_utc: { $lt: cutoffDate },
        $or: [
          { quality_score: { $lt: 30 } },
          { passes_noise_filter: false },
          { 'tickers.0': { $exists: false } } // Posts with no tickers
        ]
      };
      
      const oldPosts = await RedditPost.find(query).countDocuments();
      
      if (!dryRun) {
        const deleteResult = await RedditPost.deleteMany(query);
        console.log(`🗑️ Deleted ${deleteResult.deletedCount} old posts`);
        
        return {
          success: true,
          deleted_posts: deleteResult.deletedCount,
          cutoff_date: cutoffDate
        };
      } else {
        console.log(`📊 Would delete ${oldPosts} old posts (dry run)`);
        
        return {
          success: true,
          would_delete: oldPosts,
          cutoff_date: cutoffDate,
          dry_run: true
        };
      }
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
      throw error;
    }
  }

  // Get aggregated stock sentiment data with cross-validation
  async getStockSentimentData(ticker, timeframe = 24, enableCrossValidation = true) {
    try {
      const cutoffTime = new Date(Date.now() - timeframe * 60 * 60 * 1000);
      
      const posts = await RedditPost.find({
        'tickers.symbol': ticker.toUpperCase(),
        created_utc: { $gte: cutoffTime },
        processed: true,
        passes_noise_filter: true
      }).populate('author_profile');

      if (posts.length === 0) {
        return {
          ticker,
          mention_count: 0,
          avg_sentiment: 0,
          confidence_score: 0,
          quality_score: 0,
          subreddits: [],
          cross_validation: null,
          timeframe_hours: timeframe
        };
      }

      // Calculate aggregated metrics
      const totalSentiment = posts.reduce((sum, post) => sum + post.sentiment_score, 0);
      const totalQuality = posts.reduce((sum, post) => sum + post.quality_score, 0);
      
      // Get subreddit breakdown
      const subredditBreakdown = {};
      posts.forEach(post => {
        if (!subredditBreakdown[post.subreddit]) {
          subredditBreakdown[post.subreddit] = {
            count: 0,
            sentiment: 0,
            quality: 0
          };
        }
        subredditBreakdown[post.subreddit].count++;
        subredditBreakdown[post.subreddit].sentiment += post.sentiment_score;
        subredditBreakdown[post.subreddit].quality += post.quality_score;
      });

      // Calculate averages for each subreddit
      Object.keys(subredditBreakdown).forEach(subreddit => {
        const data = subredditBreakdown[subreddit];
        data.avg_sentiment = data.sentiment / data.count;
        data.avg_quality = data.quality / data.count;
      });

      // Perform cross-validation if enabled
      let crossValidation = null;
      if (enableCrossValidation) {
        try {
          const activeSubreddits = await SubredditConfig.getActiveSubreddits();
          const subredditNames = activeSubreddits.map(s => s.name);
          crossValidation = await redditService.validateSignalAcrossSubreddits(
            ticker, 
            subredditNames, 
            timeframe
          );
        } catch (error) {
          console.error(`⚠️ Cross-validation failed for ${ticker}:`, error.message);
          crossValidation = { error: error.message, is_validated: false };
        }
      }

      // Calculate enhanced confidence score with cross-validation
      let baseConfidence = Math.min(100, posts.length * 5 + (totalQuality / posts.length));
      let finalConfidence = baseConfidence;

      if (crossValidation && crossValidation.is_validated) {
        // Boost confidence if cross-validated
        finalConfidence = Math.min(100, baseConfidence * 1.2);
      } else if (crossValidation && !crossValidation.is_validated) {
        // Reduce confidence if not cross-validated
        finalConfidence = baseConfidence * 0.8;
      }

      return {
        ticker,
        mention_count: posts.length,
        avg_sentiment: totalSentiment / posts.length,
        confidence_score: finalConfidence,
        quality_score: totalQuality / posts.length,
        subreddits: subredditBreakdown,
        cross_validation: crossValidation,
        top_posts: posts
          .sort((a, b) => (b.upvotes + b.comments) - (a.upvotes + a.comments))
          .slice(0, 5)
          .map(post => ({
            title: post.title,
            subreddit: post.subreddit,
            upvotes: post.upvotes,
            comments: post.comments,
            sentiment_score: post.sentiment_score,
            quality_score: post.quality_score,
            created_utc: post.created_utc
          })),
        timeframe_hours: timeframe
      };
    } catch (error) {
      console.error(`❌ Error getting sentiment data for ${ticker}:`, error.message);
      throw error;
    }
  }

  // Enhanced trending stocks with cross-validation
  async getTrendingStocksWithValidation(options = {}) {
    try {
      const {
        timeframe = 24,
        minMentions = 3,
        minQuality = 30,
        limit = 20,
        requireCrossValidation = false
      } = options;

      const cutoffTime = new Date(Date.now() - timeframe * 60 * 60 * 1000);

      // Get all ticker mentions in timeframe
      const tickerAggregation = await RedditPost.aggregate([
        {
          $match: {
            created_utc: { $gte: cutoffTime },
            processed: true,
            passes_noise_filter: true,
            'tickers.0': { $exists: true }
          }
        },
        {
          $unwind: '$tickers'
        },
        {
          $group: {
            _id: '$tickers.symbol',
            mention_count: { $sum: 1 },
            avg_sentiment: { $avg: '$sentiment_score' },
            avg_quality: { $avg: '$quality_score' },
            total_upvotes: { $sum: '$upvotes' },
            total_comments: { $sum: '$comments' },
            subreddits: { $addToSet: '$subreddit' },
            latest_mention: { $max: '$created_utc' }
          }
        },
        {
          $match: {
            mention_count: { $gte: minMentions },
            avg_quality: { $gte: minQuality }
          }
        },
        {
          $sort: { mention_count: -1, avg_sentiment: -1 }
        },
        {
          $limit: limit * 2 // Get more to filter with cross-validation
        }
      ]);

      if (tickerAggregation.length === 0) {
        return [];
      }

      const enhancedResults = [];

      for (const ticker of tickerAggregation) {
        try {
          // Skip if no ticker symbol
          if (!ticker._id) {
            console.warn('⚠️ Skipping ticker in aggregation with no _id:', ticker);
            continue;
          }
          
          // Get cross-validation data
          const activeSubreddits = await SubredditConfig.getActiveSubreddits();
          const subredditNames = activeSubreddits.map(s => s.name);
          
          const crossValidation = await redditService.validateSignalAcrossSubreddits(
            ticker._id, 
            subredditNames, 
            timeframe
          );

          // Skip if cross-validation is required but not achieved
          if (requireCrossValidation && !crossValidation.is_validated) {
            continue;
          }

          // Calculate trending score with validation boost
          let trendingScore = (
            ticker.mention_count * 0.3 +
            Math.abs(ticker.avg_sentiment) * 0.25 +
            ticker.avg_quality * 0.2 +
            ticker.subreddits.length * 0.15 +
            (ticker.total_upvotes + ticker.total_comments) / 100 * 0.1
          );

          if (crossValidation.is_validated) {
            trendingScore *= 1.3; // 30% boost for cross-validated signals
          }

          enhancedResults.push({
            ticker: ticker._id,
            mention_count: ticker.mention_count,
            avg_sentiment: ticker.avg_sentiment,
            avg_quality: ticker.avg_quality,
            subreddit_count: ticker.subreddits.length,
            subreddits: ticker.subreddits,
            trending_score: Math.round(trendingScore),
            is_cross_validated: crossValidation.is_validated,
            cross_validation_score: crossValidation.cross_validation_score,
            latest_mention: ticker.latest_mention,
            engagement_score: ticker.total_upvotes + ticker.total_comments
          });

        } catch (error) {
          console.error(`⚠️ Error processing ticker ${ticker._id}:`, error.message);
          // Include without cross-validation if error occurs
          enhancedResults.push({
            ticker: ticker._id,
            mention_count: ticker.mention_count,
            avg_sentiment: ticker.avg_sentiment,
            avg_quality: ticker.avg_quality,
            subreddit_count: ticker.subreddits.length,
            subreddits: ticker.subreddits,
            trending_score: Math.round(ticker.mention_count * 0.5 + Math.abs(ticker.avg_sentiment) * 0.3),
            is_cross_validated: false,
            cross_validation_score: 0,
            latest_mention: ticker.latest_mention,
            engagement_score: ticker.total_upvotes + ticker.total_comments,
            error: error.message
          });
        }
      }

      return enhancedResults
        .sort((a, b) => b.trending_score - a.trending_score)
        .slice(0, limit);

    } catch (error) {
      console.error('❌ Error getting trending stocks with validation:', error.message);
      throw error;
    }
  }
}

module.exports = new DataProcessor();
