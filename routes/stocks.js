const express = require('express');
const router = express.Router();
const StockData = require('../models/StockData');
const alphaVantageService = require('../services/alphaVantageService');
const dataProcessor = require('../services/dataProcessor');

// GET /api/stocks/trending - Get trending stocks
router.get('/trending', async (req, res) => {
  try {
    const { limit = 20, minScore = 40 } = req.query;
    
    const trendingStocks = await StockData.find({
      trending_score: { $gte: minScore },
      'reddit_mentions.last_24h': { $gte: 3 }
    })
    .sort({ trending_score: -1, momentum_score: -1 })
    .limit(parseInt(limit));

    res.json({
      success: true,
      data: trendingStocks,
      metadata: {
        min_trending_score: minScore,
        limit: limit,
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

// GET /api/stocks/prices/:ticker - Get price data for specific ticker
router.get('/prices/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const { refresh = false } = req.query;
    
    let stockData = await StockData.findOne({ ticker: ticker.toUpperCase() });
    
    // If stock doesn't exist or needs refresh, get from AlphaVantage
    if (!stockData || refresh === 'true' || 
        !stockData.last_price_update || 
        (Date.now() - stockData.last_price_update.getTime()) > 15 * 60 * 1000) { // 15 minutes
      
      try {
        const quote = await alphaVantageService.getQuote(ticker);
        
        if (!stockData) {
          stockData = new StockData({
            ticker: ticker.toUpperCase(),
            current_price: quote.price,
            price_change: quote.change,
            price_change_percent: parseFloat(quote.change_percent)
          });
        } else {
          stockData.current_price = quote.price;
          stockData.price_change = quote.change;
          stockData.price_change_percent = parseFloat(quote.change_percent);
        }
        
        // Add price data point
        stockData.addPriceData({
          timestamp: new Date(quote.latest_trading_day),
          open: quote.open,
          high: quote.high,
          low: quote.low,
          close: quote.price,
          volume: quote.volume
        });
        
        await stockData.save();
        
      } catch (apiError) {
        console.error(`Error fetching price for ${ticker}:`, apiError.message);
        
        if (!stockData) {
          return res.status(404).json({
            success: false,
            error: `Stock data not found for ${ticker} and API fetch failed`
          });
        }
        // Continue with existing data if API fails
      }
    }

    res.json({
      success: true,
      data: stockData,
      metadata: {
        ticker: ticker.toUpperCase(),
        last_updated: stockData.last_price_update,
        data_age_minutes: stockData.last_price_update ? 
          Math.floor((Date.now() - stockData.last_price_update.getTime()) / (1000 * 60)) : null,
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

// GET /api/stocks/search/:query - Search for stocks
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    
    // Search in our database first
    const dbResults = await StockData.find({
      $or: [
        { ticker: { $regex: query, $options: 'i' } },
        { company_name: { $regex: query, $options: 'i' } }
      ]
    }).limit(10);

    // Also search via AlphaVantage API
    let apiResults = [];
    try {
      apiResults = await alphaVantageService.searchSymbol(query);
    } catch (apiError) {
      console.error('AlphaVantage search failed:', apiError.message);
    }

    res.json({
      success: true,
      data: {
        database_results: dbResults,
        api_results: apiResults.slice(0, 10)
      },
      metadata: {
        query: query,
        total_db_results: dbResults.length,
        total_api_results: apiResults.length,
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

// GET /api/stocks/validate/:ticker - Validate if ticker exists
router.get('/validate/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    
    const validation = await alphaVantageService.validateSymbol(ticker);
    
    res.json({
      success: true,
      data: validation,
      metadata: {
        ticker: ticker.toUpperCase(),
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

// GET /api/stocks/daily/:ticker - Get daily price data
router.get('/daily/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const { outputSize = 'compact' } = req.query;
    
    const dailyData = await alphaVantageService.getDailyData(ticker, outputSize);
    
    res.json({
      success: true,
      data: dailyData,
      metadata: {
        ticker: ticker.toUpperCase(),
        output_size: outputSize,
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

// GET /api/stocks/intraday/:ticker - Get intraday price data
router.get('/intraday/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const { interval = '5min' } = req.query;
    
    const intradayData = await alphaVantageService.getIntradayData(ticker, interval);
    
    res.json({
      success: true,
      data: intradayData,
      metadata: {
        ticker: ticker.toUpperCase(),
        interval: interval,
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

// GET /api/stocks/technical/:ticker/:indicator - Get technical indicators
router.get('/technical/:ticker/:indicator', async (req, res) => {
  try {
    const { ticker, indicator } = req.params;
    const { interval = 'daily', timePeriod = 20 } = req.query;
    
    const technicalData = await alphaVantageService.getTechnicalIndicator(
      ticker, 
      indicator, 
      interval, 
      parseInt(timePeriod)
    );
    
    res.json({
      success: true,
      data: technicalData,
      metadata: {
        ticker: ticker.toUpperCase(),
        indicator: indicator.toUpperCase(),
        interval: interval,
        time_period: timePeriod,
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

// GET /api/stocks/sector-performance - Get sector performance data
router.get('/sector-performance', async (req, res) => {
  try {
    const sectorData = await alphaVantageService.getSectorPerformance();
    
    res.json({
      success: true,
      data: sectorData,
      metadata: {
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

// POST /api/stocks/refresh-multiple - Refresh price data for multiple tickers
router.post('/refresh-multiple', async (req, res) => {
  try {
    const { tickers } = req.body;
    
    if (!Array.isArray(tickers) || tickers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an array of tickers'
      });
    }

    if (tickers.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 tickers allowed per request'
      });
    }

    const results = await alphaVantageService.getMultipleQuotes(tickers);
    
    // Update our database with the results
    for (const result of results) {
      if (result.success) {
        try {
          let stockData = await StockData.findOne({ ticker: result.symbol });
          
          if (!stockData) {
            stockData = new StockData({ ticker: result.symbol });
          }
          
          stockData.current_price = result.quote.price;
          stockData.price_change = result.quote.change;
          stockData.price_change_percent = parseFloat(result.quote.change_percent);
          
          stockData.addPriceData({
            timestamp: new Date(result.quote.latest_trading_day),
            open: result.quote.open,
            high: result.quote.high,
            low: result.quote.low,
            close: result.quote.price,
            volume: result.quote.volume
          });
          
          await stockData.save();
        } catch (dbError) {
          console.error(`Error saving data for ${result.symbol}:`, dbError.message);
          result.db_error = dbError.message;
        }
      }
    }

    res.json({
      success: true,
      data: results,
      metadata: {
        total_requested: tickers.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
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

// GET /api/stocks/api-status - Get AlphaVantage API usage status
router.get('/api-status', async (req, res) => {
  try {
    const usageStats = alphaVantageService.getUsageStats();
    
    res.json({
      success: true,
      data: usageStats,
      metadata: {
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

// GET /api/stocks/sentiment-correlation/:ticker - Correlation between price and sentiment
router.get('/sentiment-correlation/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const { days = 7 } = req.query;
    
    const stockData = await StockData.findOne({ ticker: ticker.toUpperCase() });
    
    if (!stockData) {
      return res.status(404).json({
        success: false,
        error: `Stock data not found for ${ticker}`
      });
    }

    // Get recent price data
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recentPriceData = stockData.price_data.filter(
      point => point.timestamp >= cutoffDate
    ).sort((a, b) => a.timestamp - b.timestamp);

    // Calculate correlation metrics
    const correlation = {
      ticker: ticker.toUpperCase(),
      current_price: stockData.current_price,
      current_sentiment: stockData.sentiment_trend.current,
      price_change_percent: stockData.price_change_percent,
      sentiment_change: stockData.sentiment_trend.change,
      price_momentum: stockData.price_momentum,
      sentiment_momentum: stockData.momentum_score,
      price_data_points: recentPriceData.length,
      last_updated: stockData.last_updated
    };

    res.json({
      success: true,
      data: correlation,
      metadata: {
        ticker: ticker.toUpperCase(),
        days_analyzed: days,
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

// GET /api/stocks/:ticker/sentiment - Get sentiment data with cross-validation
router.get('/:ticker/sentiment', async (req, res) => {
  try {
    const { ticker } = req.params;
    const { timeframe = 24, cross_validation = true } = req.query;
    
    const sentimentData = await dataProcessor.getStockSentimentData(
      ticker, 
      parseInt(timeframe), 
      cross_validation === 'true'
    );

    res.json({
      success: true,
      data: sentimentData,
      metadata: {
        ticker,
        timeframe_hours: parseInt(timeframe),
        cross_validation_enabled: cross_validation === 'true',
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

// GET /api/stocks/trending/validated - Get trending stocks with cross-validation
router.get('/trending/validated', async (req, res) => {
  try {
    const {
      timeframe = 24,
      min_mentions = 3,
      min_quality = 30,
      limit = 20,
      require_validation = false
    } = req.query;

    const options = {
      timeframe: parseInt(timeframe),
      minMentions: parseInt(min_mentions),
      minQuality: parseInt(min_quality),
      limit: parseInt(limit),
      requireCrossValidation: require_validation === 'true'
    };

    const trendingStocks = await dataProcessor.getTrendingStocksWithValidation(options);

    res.json({
      success: true,
      data: trendingStocks,
      metadata: {
        filters: options,
        results_count: trendingStocks.length,
        cross_validated_count: trendingStocks.filter(s => s.is_cross_validated).length,
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

// GET /api/stocks/trending/comparison - Compare regular vs cross-validated trending
router.get('/trending/comparison', async (req, res) => {
  try {
    const { timeframe = 24, limit = 10 } = req.query;

    const options = {
      timeframe: parseInt(timeframe),
      minMentions: 3,
      minQuality: 30,
      limit: parseInt(limit)
    };

    // Get both regular and cross-validated results
    const [allTrending, validatedTrending] = await Promise.all([
      dataProcessor.getTrendingStocksWithValidation({ ...options, requireCrossValidation: false }),
      dataProcessor.getTrendingStocksWithValidation({ ...options, requireCrossValidation: true })
    ]);

    const comparison = {
      all_trending: allTrending,
      cross_validated_only: validatedTrending,
      validation_impact: {
        total_stocks: allTrending.length,
        cross_validated_stocks: validatedTrending.length,
        validation_rate: allTrending.length > 0 ? 
          (validatedTrending.length / allTrending.length * 100).toFixed(1) + '%' : '0%',
        avg_confidence_boost: allTrending.length > 0 ? 
          allTrending
            .filter(s => s.is_cross_validated)
            .reduce((sum, s) => sum + (s.cross_validation_score || 0), 0) / 
            allTrending.filter(s => s.is_cross_validated).length || 0 : 0
      }
    };

    res.json({
      success: true,
      data: comparison,
      metadata: {
        timeframe_hours: parseInt(timeframe),
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

module.exports = router;
