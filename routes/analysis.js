const express = require('express');
const router = express.Router();
const claudeService = require('../services/claudeService');
const newsService = require('../services/newsService');
const fredService = require('../services/fredService');
const userReputationService = require('../services/userReputationService');
const confidenceService = require('../services/confidenceService');
const dataProcessor = require('../services/dataProcessor');
const RedditPost = require('../models/RedditPost');
const UserProfile = require('../models/UserProfile');
const StockData = require('../models/StockData');

// ==================== CLAUDE AI ANALYSIS ====================

// POST /api/analysis/claude/sentiment - Analyze sentiment with Claude
router.post('/claude/sentiment', async (req, res) => {
  try {
    const { text, title, ticker } = req.body;
    
    if (!text && !title) {
      return res.status(400).json({
        success: false,
        error: 'Text or title is required'
      });
    }

    const analysis = await claudeService.analyzeSentiment(text, title, ticker);
    
    res.json({
      success: true,
      data: analysis,
      metadata: {
        model_used: claudeService.model,
        analysis_type: 'claude_sentiment',
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

// POST /api/analysis/claude/batch-sentiment - Batch sentiment analysis
router.post('/claude/batch-sentiment', async (req, res) => {
  try {
    const { posts, maxConcurrent = 3 } = req.body;
    
    if (!posts || !Array.isArray(posts)) {
      return res.status(400).json({
        success: false,
        error: 'Posts array is required'
      });
    }

    const results = await claudeService.batchAnalyzeSentiment(posts, maxConcurrent);
    
    res.json({
      success: true,
      data: results,
      metadata: {
        posts_analyzed: results.length,
        max_concurrent: maxConcurrent,
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

// POST /api/analysis/claude/quality - Assess post quality with Claude
router.post('/claude/quality', async (req, res) => {
  try {
    const { post } = req.body;
    
    if (!post) {
      return res.status(400).json({
        success: false,
        error: 'Post object is required'
      });
    }

    const assessment = await claudeService.assessPostQuality(post);
    
    res.json({
      success: true,
      data: assessment,
      metadata: {
        assessment_type: 'claude_quality',
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

// POST /api/analysis/claude/detect-manipulation - Detect coordinated posting
router.post('/claude/detect-manipulation', async (req, res) => {
  try {
    const { posts } = req.body;
    
    if (!posts || !Array.isArray(posts) || posts.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least 2 posts are required for manipulation detection'
      });
    }

    const detection = await claudeService.detectManipulation(posts);
    
    res.json({
      success: true,
      data: detection,
      metadata: {
        posts_analyzed: posts.length,
        detection_type: 'claude_manipulation',
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

// POST /api/analysis/claude/summarize - Summarize complex posts
router.post('/claude/summarize', async (req, res) => {
  try {
    const { post, maxLength = 200 } = req.body;
    
    if (!post) {
      return res.status(400).json({
        success: false,
        error: 'Post object is required'
      });
    }

    const summary = await claudeService.summarizePost(post, maxLength);
    
    res.json({
      success: true,
      data: {
        summary,
        original_length: (post.title + post.content).length,
        summary_length: summary.length
      },
      metadata: {
        max_length: maxLength,
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

// GET /api/analysis/claude/usage - Get Claude API usage stats
router.get('/claude/usage', async (req, res) => {
  try {
    const usage = claudeService.getUsageStats();
    
    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== NEWS CORRELATION ====================

// GET /api/analysis/news/:ticker - Get news for ticker
router.get('/news/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const { timeframe = '7d', pageSize = 20 } = req.query;
    
    const news = await newsService.getTickerNews(ticker, { timeframe, pageSize });
    
    res.json({
      success: true,
      data: news,
      metadata: {
        ticker: ticker.toUpperCase(),
        timeframe,
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

// GET /api/analysis/news/market - Get general market news
router.get('/news/market', async (req, res) => {
  try {
    const { category = 'business', timeframe = '1d', pageSize = 50 } = req.query;
    
    const news = await newsService.getMarketNews({ category, timeframe, pageSize });
    
    res.json({
      success: true,
      data: news,
      metadata: {
        category,
        timeframe,
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

// POST /api/analysis/news/correlate - Correlate news with Reddit sentiment
router.post('/news/correlate', async (req, res) => {
  try {
    const { ticker, redditSentiment, timeframe = '7d' } = req.body;
    
    if (!ticker || typeof redditSentiment !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Ticker and redditSentiment are required'
      });
    }

    const correlation = await newsService.correlateWithRedditSentiment(
      ticker, 
      redditSentiment, 
      { timeframe }
    );
    
    res.json({
      success: true,
      data: correlation,
      metadata: {
        analysis_type: 'news_sentiment_correlation',
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

// POST /api/analysis/news/batch-correlate - Batch correlate multiple tickers
router.post('/news/batch-correlate', async (req, res) => {
  try {
    const { tickers, redditSentiments, timeframe = '7d' } = req.body;
    
    if (!tickers || !redditSentiments || tickers.length !== redditSentiments.length) {
      return res.status(400).json({
        success: false,
        error: 'Tickers and redditSentiments arrays must be provided and have same length'
      });
    }

    const correlations = await newsService.batchCorrelateNews(
      tickers, 
      redditSentiments, 
      { timeframe }
    );
    
    res.json({
      success: true,
      data: correlations,
      metadata: {
        tickers_analyzed: tickers.length,
        timeframe,
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

// GET /api/analysis/news/search - Search financial news
router.get('/news/search', async (req, res) => {
  try {
    const { q, timeframe = '7d', pageSize = 30 } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter (q) is required'
      });
    }

    const results = await newsService.searchFinancialNews(q, { timeframe, pageSize });
    
    res.json({
      success: true,
      data: results,
      metadata: {
        query: q,
        timeframe,
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

// GET /api/analysis/news/usage - Get NewsAPI usage stats
router.get('/news/usage', async (req, res) => {
  try {
    const usage = newsService.getUsageStats();
    
    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== ECONOMIC DATA ====================

// GET /api/analysis/economic/indicators - Get current economic indicators
router.get('/economic/indicators', async (req, res) => {
  try {
    const { indicators } = req.query;
    let indicatorKeys = null;
    
    if (indicators) {
      indicatorKeys = indicators.split(',');
    }

    const economicData = await fredService.getCurrentIndicators(indicatorKeys);
    
    res.json({
      success: true,
      data: economicData,
      metadata: {
        indicators_requested: indicatorKeys ? indicatorKeys.length : 'all',
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

// GET /api/analysis/economic/history/:indicator - Get historical data for indicator
router.get('/economic/history/:indicator', async (req, res) => {
  try {
    const { indicator } = req.params;
    const { startDate, endDate, frequency = 'monthly' } = req.query;
    
    const history = await fredService.getIndicatorHistory(indicator, {
      startDate,
      endDate,
      frequency
    });
    
    res.json({
      success: true,
      data: history,
      metadata: {
        indicator,
        frequency,
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

// POST /api/analysis/economic/correlate - Correlate economic data with stock sentiment
router.post('/economic/correlate', async (req, res) => {
  try {
    const { ticker, sentiment } = req.body;
    
    if (!ticker || typeof sentiment !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Ticker and sentiment are required'
      });
    }

    const correlation = await fredService.correlateWithStockSentiment(ticker, sentiment);
    
    res.json({
      success: true,
      data: correlation,
      metadata: {
        analysis_type: 'economic_sentiment_correlation',
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

// GET /api/analysis/economic/usage - Get FRED API usage stats
router.get('/economic/usage', async (req, res) => {
  try {
    const usage = fredService.getUsageStats();
    
    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== USER REPUTATION ====================

// GET /api/analysis/users/reputation/:username - Get enhanced user reputation
router.get('/users/reputation/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    const reputation = await userReputationService.calculateEnhancedReputation(username);
    
    if (!reputation) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.json({
      success: true,
      data: reputation,
      metadata: {
        analysis_type: 'enhanced_user_reputation',
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

// GET /api/analysis/users/top - Get top users by reputation
router.get('/users/top', async (req, res) => {
  try {
    const { 
      limit = 50, 
      minPosts = 5, 
      tier = null, 
      sortBy = 'quality_score' 
    } = req.query;
    
    const topUsers = await userReputationService.getTopUsers({
      limit: parseInt(limit),
      minPosts: parseInt(minPosts),
      tier,
      sortBy
    });
    
    res.json({
      success: true,
      data: topUsers,
      metadata: {
        limit,
        min_posts: minPosts,
        tier: tier || 'all',
        sort_by: sortBy,
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

// ==================== CONFIDENCE ANALYSIS ====================

// GET /api/analysis/confidence/:ticker - Get comprehensive confidence analysis
router.get('/confidence/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const { 
      timeframe = 24,
      includeNews = true,
      includeEconomic = true,
      includeUserReputation = true,
      includeCrossValidation = true
    } = req.query;
    
    const confidence = await confidenceService.calculateComprehensiveConfidence(ticker, {
      timeframe: parseInt(timeframe),
      includeNews: includeNews === 'true',
      includeEconomic: includeEconomic === 'true',
      includeUserReputation: includeUserReputation === 'true',
      includeCrossValidation: includeCrossValidation === 'true'
    });
    
    res.json({
      success: true,
      data: confidence,
      metadata: {
        analysis_type: 'comprehensive_confidence',
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

// POST /api/analysis/confidence/batch - Batch confidence analysis
router.post('/confidence/batch', async (req, res) => {
  try {
    const { tickers, options = {} } = req.body;
    
    if (!tickers || !Array.isArray(tickers)) {
      return res.status(400).json({
        success: false,
        error: 'Tickers array is required'
      });
    }

    const results = await confidenceService.batchCalculateConfidence(tickers, options);
    
    res.json({
      success: true,
      data: results,
      metadata: {
        tickers_analyzed: tickers.length,
        options_used: options,
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

// GET /api/analysis/confidence/statistics - Get confidence calculation methodology
router.get('/confidence/statistics', async (req, res) => {
  try {
    const stats = confidenceService.getConfidenceStatistics();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== ENHANCED STOCK ANALYSIS ====================

// GET /api/analysis/stocks/:ticker/comprehensive - Get comprehensive stock analysis
router.get('/stocks/:ticker/comprehensive', async (req, res) => {
  try {
    const { ticker } = req.params;
    const { timeframe = 24 } = req.query;
    
    // Get all Phase 3 analyses for the ticker
    const [
      confidenceAnalysis,
      newsCorrelation,
      economicContext
    ] = await Promise.allSettled([
      confidenceService.calculateComprehensiveConfidence(ticker, { timeframe }),
      newsService.correlateWithRedditSentiment(ticker, 0), // Will get actual sentiment from confidence analysis
      fredService.correlateWithStockSentiment(ticker, 0)
    ]);
    
    const result = {
      ticker: ticker.toUpperCase(),
      timeframe_hours: timeframe,
      confidence_analysis: confidenceAnalysis.status === 'fulfilled' ? confidenceAnalysis.value : null,
      news_correlation: newsCorrelation.status === 'fulfilled' ? newsCorrelation.value : null,
      economic_context: economicContext.status === 'fulfilled' ? economicContext.value : null,
      analysis_errors: []
    };
    
    // Track any errors
    if (confidenceAnalysis.status === 'rejected') {
      result.analysis_errors.push({ component: 'confidence', error: confidenceAnalysis.reason.message });
    }
    if (newsCorrelation.status === 'rejected') {
      result.analysis_errors.push({ component: 'news', error: newsCorrelation.reason.message });
    }
    if (economicContext.status === 'rejected') {
      result.analysis_errors.push({ component: 'economic', error: economicContext.reason.message });
    }
    
    res.json({
      success: true,
      data: result,
      metadata: {
        analysis_type: 'comprehensive_stock_analysis',
        components_analyzed: 3,
        errors: result.analysis_errors.length,
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

// GET /api/analysis/stocks/enhanced-trending - Get trending stocks with Phase 3 enhancements
router.get('/stocks/enhanced-trending', async (req, res) => {
  try {
    const { 
      limit = 20, 
      minConfidence = 60,
      requireNews = false,
      requireEconomic = false,
      timeframe = 24
    } = req.query;
    
    // Get basic trending stocks first
    const trendingStocks = await StockData.find({
      trending_score: { $gte: 40 },
      'reddit_mentions.last_24h': { $gte: 3 }
    })
    .sort({ trending_score: -1 })
    .limit(parseInt(limit) * 2) // Get more to filter
    .lean();
    
    // Enhance with Phase 3 analysis
    const enhancedStocks = [];
    for (const stock of trendingStocks.slice(0, Math.min(10, trendingStocks.length))) {
      try {
        const confidence = await confidenceService.calculateComprehensiveConfidence(
          stock.ticker, 
          { 
            timeframe,
            includeNews: requireNews === 'true',
            includeEconomic: requireEconomic === 'true'
          }
        );
        
        if (confidence.confidence_score >= minConfidence) {
          enhancedStocks.push({
            ...stock,
            phase3_analysis: confidence
          });
        }
      } catch (error) {
        console.error(`Error enhancing ${stock.ticker}:`, error.message);
        // Include without enhancement if individual analysis fails
        enhancedStocks.push(stock);
      }
      
      if (enhancedStocks.length >= limit) break;
    }
    
    res.json({
      success: true,
      data: enhancedStocks,
      metadata: {
        min_confidence: minConfidence,
        require_news: requireNews === 'true',
        require_economic: requireEconomic === 'true',
        timeframe_hours: timeframe,
        enhanced_count: enhancedStocks.filter(s => s.phase3_analysis).length,
        total_results: enhancedStocks.length,
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

// ==================== SYSTEM STATUS ====================

// GET /api/analysis/status - Get Phase 3 system status
router.get('/status', async (req, res) => {
  try {
    const [claudeUsage, newsUsage, fredUsage] = await Promise.allSettled([
      Promise.resolve(claudeService.getUsageStats()),
      Promise.resolve(newsService.getUsageStats()),
      Promise.resolve(fredService.getUsageStats())
    ]);
    
    const status = {
      phase3_features: {
        claude_api: {
          status: claudeUsage.status === 'fulfilled' ? 'operational' : 'error',
          usage: claudeUsage.status === 'fulfilled' ? claudeUsage.value : null
        },
        news_api: {
          status: newsUsage.status === 'fulfilled' ? 'operational' : 'error',
          usage: newsUsage.status === 'fulfilled' ? newsUsage.value : null
        },
        fred_api: {
          status: fredUsage.status === 'fulfilled' ? 'operational' : 'error',
          usage: fredUsage.status === 'fulfilled' ? fredUsage.value : null
        }
      },
      confidence_service: {
        status: 'operational',
        methodology: confidenceService.getConfidenceStatistics()
      },
      system_health: {
        all_services_operational: [claudeUsage, newsUsage, fredUsage].every(s => s.status === 'fulfilled'),
        phase3_implementation: 'complete',
        last_checked: new Date().toISOString()
      }
    };
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== DATA CLEANUP ====================

// POST /api/analysis/cleanup/false-positives - Clean up false positive tickers
router.post('/cleanup/false-positives', async (req, res) => {
  try {
    console.log('🧹 Manual cleanup of false positive tickers requested');
    const result = await dataProcessor.cleanupFalsePositiveTickers();
    
    res.json({
      success: true,
      data: result,
      metadata: {
        cleaned_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error during false positive cleanup:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
