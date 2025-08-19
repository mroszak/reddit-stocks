const express = require('express');
const router = express.Router();
const RedditPost = require('../models/RedditPost');
const StockData = require('../models/StockData');
const dataProcessor = require('../services/dataProcessor');
const redditService = require('../services/redditService');

// GET /api/reddit/trending - Get trending stocks based on Reddit mentions
router.get('/trending', async (req, res) => {
  try {
    const { limit = 20, timeframe = 24, minMentions = 5, minQuality = 30 } = req.query;
    
    const cutoffTime = new Date(Date.now() - timeframe * 60 * 60 * 1000);
    
    const trendingStocks = await RedditPost.aggregate([
      {
        $match: {
          created_utc: { $gte: cutoffTime },
          passes_noise_filter: true,
          processed: true,
          quality_score: { $gte: minQuality }
        }
      },
      { $unwind: '$tickers' },
      {
        $group: {
          _id: '$tickers.symbol',
          mention_count: { $sum: 1 },
          total_mentions: { $sum: '$tickers.mentions' },
          avg_sentiment: { $avg: '$sentiment_score' },
          avg_quality: { $avg: '$quality_score' },
          weighted_sentiment: { $avg: '$weighted_sentiment' },
          max_upvotes: { $max: '$upvotes' },
          total_comments: { $sum: '$comments' },
          unique_authors: { $addToSet: '$author' },
          subreddits: { $addToSet: '$subreddit' }
        }
      },
      {
        $addFields: {
          author_count: { $size: '$unique_authors' },
          subreddit_count: { $size: '$subreddits' },
          trending_score: {
            $multiply: [
              '$mention_count',
              { $divide: [{ $add: ['$avg_sentiment', 100] }, 200] }, // Normalize sentiment to 0-1
              { $divide: ['$avg_quality', 100] }
            ]
          }
        }
      },
      {
        $match: {
          mention_count: { $gte: parseInt(minMentions) }
        }
      },
      { $sort: { trending_score: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: trendingStocks,
      metadata: {
        timeframe_hours: timeframe,
        min_mentions: minMentions,
        min_quality: minQuality,
        total_results: trendingStocks.length,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/reddit/stock/:ticker - Get Reddit discussions for specific ticker
router.get('/stock/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const { limit = 50, timeframe = 24, sortBy = 'created_utc' } = req.query;
    
    const cutoffTime = new Date(Date.now() - timeframe * 60 * 60 * 1000);
    
    const posts = await RedditPost.find({
      'tickers.symbol': ticker.toUpperCase(),
      created_utc: { $gte: cutoffTime },
      processed: true
    })
    .sort({ [sortBy]: -1 })
    .limit(parseInt(limit))
    .populate('tickers');

    // Get aggregated statistics
    const stats = await RedditPost.aggregate([
      {
        $match: {
          'tickers.symbol': ticker.toUpperCase(),
          created_utc: { $gte: cutoffTime },
          processed: true
        }
      },
      {
        $group: {
          _id: null,
          total_posts: { $sum: 1 },
          avg_sentiment: { $avg: '$sentiment_score' },
          avg_quality: { $avg: '$quality_score' },
          total_upvotes: { $sum: '$upvotes' },
          total_comments: { $sum: '$comments' },
          unique_authors: { $addToSet: '$author' },
          subreddits: { $addToSet: '$subreddit' }
        }
      },
      {
        $addFields: {
          author_count: { $size: '$unique_authors' },
          subreddit_count: { $size: '$subreddits' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        ticker: ticker.toUpperCase(),
        posts: posts,
        statistics: stats[0] || {
          total_posts: 0,
          avg_sentiment: 0,
          avg_quality: 0,
          total_upvotes: 0,
          total_comments: 0,
          author_count: 0,
          subreddit_count: 0
        }
      },
      metadata: {
        timeframe_hours: timeframe,
        limit: limit,
        total_results: posts.length,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/reddit/process - Trigger data processing manually
router.post('/process', async (req, res) => {
  try {
    const options = req.body || {};
    const result = await dataProcessor.processRedditData(options);
    
    res.json({
      success: result.success,
      data: result,
      message: result.success ? 'Data processing completed' : 'Data processing failed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/reddit/stats - Get processing statistics
router.get('/stats', async (req, res) => {
  try {
    const processingStats = dataProcessor.getProcessingStats();
    const redditStats = redditService.getStatus();
    
    // Get database statistics
    const dbStats = {
      total_posts: await RedditPost.countDocuments(),
      processed_posts: await RedditPost.countDocuments({ processed: true }),
      posts_last_24h: await RedditPost.countDocuments({
        created_utc: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }),
      unique_tickers: await RedditPost.distinct('tickers.symbol').then(tickers => tickers.length),
      unique_authors: await RedditPost.distinct('author').then(authors => authors.length)
    };

    res.json({
      success: true,
      data: {
        processing: processingStats,
        reddit_api: redditStats,
        database: dbStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/reddit/sentiment/:ticker - Get sentiment analysis for specific ticker
router.get('/sentiment/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const { timeframe = 24 } = req.query;
    
    const cutoffTime = new Date(Date.now() - timeframe * 60 * 60 * 1000);
    
    // Get sentiment over time
    const sentimentTimeline = await RedditPost.aggregate([
      {
        $match: {
          'tickers.symbol': ticker.toUpperCase(),
          created_utc: { $gte: cutoffTime },
          processed: true,
          passes_noise_filter: true
        }
      },
      {
        $group: {
          _id: {
            hour: { $dateToString: { format: "%Y-%m-%d-%H", date: "$created_utc" } }
          },
          avg_sentiment: { $avg: '$sentiment_score' },
          weighted_sentiment: { $avg: '$weighted_sentiment' },
          post_count: { $sum: 1 },
          avg_quality: { $avg: '$quality_score' }
        }
      },
      { $sort: { '_id.hour': 1 } }
    ]);

    // Get sentiment by subreddit
    const sentimentBySubreddit = await RedditPost.aggregate([
      {
        $match: {
          'tickers.symbol': ticker.toUpperCase(),
          created_utc: { $gte: cutoffTime },
          processed: true,
          passes_noise_filter: true
        }
      },
      {
        $group: {
          _id: '$subreddit',
          avg_sentiment: { $avg: '$sentiment_score' },
          post_count: { $sum: 1 },
          avg_quality: { $avg: '$quality_score' }
        }
      },
      { $sort: { post_count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        ticker: ticker.toUpperCase(),
        timeline: sentimentTimeline,
        by_subreddit: sentimentBySubreddit
      },
      metadata: {
        timeframe_hours: timeframe,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/reddit/quality-users - Get top quality users
router.get('/quality-users', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const qualityUsers = await RedditPost.aggregate([
      {
        $match: {
          processed: true,
          passes_noise_filter: true,
          quality_score: { $gte: 60 }
        }
      },
      {
        $group: {
          _id: '$author',
          avg_quality: { $avg: '$quality_score' },
          avg_sentiment: { $avg: '$sentiment_score' },
          post_count: { $sum: 1 },
          total_upvotes: { $sum: '$upvotes' },
          total_comments: { $sum: '$comments' },
          unique_tickers: { $addToSet: '$tickers.symbol' }
        }
      },
      {
        $addFields: {
          ticker_count: { $size: '$unique_tickers' }
        }
      },
      { $sort: { avg_quality: -1, post_count: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: qualityUsers,
      metadata: {
        total_results: qualityUsers.length,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/reddit/cleanup - Clean up old data
router.delete('/cleanup', async (req, res) => {
  try {
    const { daysToKeep = 30, dryRun = true } = req.body;
    
    const result = await dataProcessor.cleanupOldData({
      daysToKeep: parseInt(daysToKeep),
      dryRun: dryRun === true || dryRun === 'true'
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
