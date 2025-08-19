const express = require('express');
const router = express.Router();
const SubredditConfig = require('../models/SubredditConfig');
const redditService = require('../services/redditService');
const monitoringService = require('../services/monitoringService');

// GET /api/subreddits - List all configured subreddits
router.get('/', async (req, res) => {
  try {
    const { active_only = false } = req.query;
    
    const query = active_only === 'true' ? { is_active: true } : {};
    const subreddits = await SubredditConfig.find(query)
      .sort({ 'performance_metrics.accuracy_rate': -1, subscribers: -1 });

    res.json({
      success: true,
      data: subreddits,
      metadata: {
        total_subreddits: subreddits.length,
        active_only: active_only === 'true',
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

// POST /api/subreddits - Add new subreddit
router.post('/', async (req, res) => {
  try {
    const { name, display_name, description, config } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Subreddit name is required'
      });
    }

    // Check if subreddit already exists
    const existingSubreddit = await SubredditConfig.findOne({ 
      name: name.toLowerCase() 
    });
    
    if (existingSubreddit) {
      return res.status(409).json({
        success: false,
        error: `Subreddit r/${name} already exists`
      });
    }

    // Validate subreddit with Reddit API
    const validation = await redditService.validateSubreddit(name);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: `Invalid subreddit: ${validation.error}`
      });
    }

    // Create new subreddit configuration
    const subredditConfig = new SubredditConfig({
      name: name.toLowerCase(),
      display_name: display_name || validation.display_name || name,
      description: description || validation.description || '',
      subscribers: validation.subscribers || 0,
      is_public: validation.is_public !== false,
      config: {
        min_upvotes: 5,
        min_comments: 2,
        quality_threshold: 30,
        max_posts_per_hour: 50,
        ...config // Override defaults with provided config
      }
    });

    await subredditConfig.save();

    res.status(201).json({
      success: true,
      data: subredditConfig,
      message: `Subreddit r/${name} added successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/subreddits/:name - Get specific subreddit configuration
router.get('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    
    const subreddit = await SubredditConfig.findOne({ 
      name: name.toLowerCase() 
    });

    if (!subreddit) {
      return res.status(404).json({
        success: false,
        error: `Subreddit r/${name} not found`
      });
    }

    res.json({
      success: true,
      data: subreddit,
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

// PUT /api/subreddits/:name - Update subreddit configuration
router.put('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const updates = req.body;
    
    const subreddit = await SubredditConfig.findOne({ 
      name: name.toLowerCase() 
    });

    if (!subreddit) {
      return res.status(404).json({
        success: false,
        error: `Subreddit r/${name} not found`
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      'display_name', 'description', 'is_active', 'config'
    ];

    for (const field of allowedUpdates) {
      if (updates[field] !== undefined) {
        if (field === 'config') {
          // Merge config instead of replacing
          subreddit.config = { ...subreddit.config, ...updates.config };
        } else {
          subreddit[field] = updates[field];
        }
      }
    }

    subreddit.last_updated = new Date();
    await subreddit.save();

    res.json({
      success: true,
      data: subreddit,
      message: `Subreddit r/${name} updated successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/subreddits/:name - Remove subreddit
router.delete('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    
    const subreddit = await SubredditConfig.findOneAndDelete({ 
      name: name.toLowerCase() 
    });

    if (!subreddit) {
      return res.status(404).json({
        success: false,
        error: `Subreddit r/${name} not found`
      });
    }

    res.json({
      success: true,
      data: { name: subreddit.name },
      message: `Subreddit r/${name} removed successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/subreddits/:name/stats - Get subreddit performance statistics
router.get('/:name/stats', async (req, res) => {
  try {
    const { name } = req.params;
    const { days = 7 } = req.query;
    
    const subreddit = await SubredditConfig.findOne({ 
      name: name.toLowerCase() 
    });

    if (!subreddit) {
      return res.status(404).json({
        success: false,
        error: `Subreddit r/${name} not found`
      });
    }

    // Recalculate performance metrics
    await subreddit.calculatePerformance();

    // Get additional statistics from Redis posts
    const RedditPost = require('../models/RedditPost');
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const postStats = await RedditPost.aggregate([
      {
        $match: {
          subreddit: name.toLowerCase(),
          created_utc: { $gte: cutoffDate },
          processed: true
        }
      },
      {
        $group: {
          _id: null,
          total_posts: { $sum: 1 },
          avg_quality: { $avg: '$quality_score' },
          avg_sentiment: { $avg: '$sentiment_score' },
          total_upvotes: { $sum: '$upvotes' },
          total_comments: { $sum: '$comments' },
          unique_tickers: { $addToSet: '$tickers.symbol' },
          unique_authors: { $addToSet: '$author' },
          posts_passing_filter: { $sum: { $cond: ['$passes_noise_filter', 1, 0] } }
        }
      },
      {
        $addFields: {
          ticker_count: { $size: '$unique_tickers' },
          author_count: { $size: '$unique_authors' },
          filter_pass_rate: { $divide: ['$posts_passing_filter', '$total_posts'] }
        }
      }
    ]);

    const stats = postStats[0] || {
      total_posts: 0,
      avg_quality: 0,
      avg_sentiment: 0,
      total_upvotes: 0,
      total_comments: 0,
      ticker_count: 0,
      author_count: 0,
      filter_pass_rate: 0
    };

    res.json({
      success: true,
      data: {
        subreddit: subreddit,
        period_stats: stats,
        performance_score: subreddit.performance_score
      },
      metadata: {
        subreddit_name: name,
        analysis_period_days: days,
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

// POST /api/subreddits/validate - Validate if subreddit exists and is accessible
router.post('/validate', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Subreddit name is required'
      });
    }

    const validation = await redditService.validateSubreddit(name);
    
    res.json({
      success: true,
      data: validation,
      metadata: {
        subreddit_name: name,
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

// POST /api/subreddits/:name/toggle - Toggle subreddit active status
router.post('/:name/toggle', async (req, res) => {
  try {
    const { name } = req.params;
    
    const subreddit = await SubredditConfig.findOne({ 
      name: name.toLowerCase() 
    });

    if (!subreddit) {
      return res.status(404).json({
        success: false,
        error: `Subreddit r/${name} not found`
      });
    }

    subreddit.is_active = !subreddit.is_active;
    subreddit.last_updated = new Date();
    await subreddit.save();

    res.json({
      success: true,
      data: {
        name: subreddit.name,
        is_active: subreddit.is_active
      },
      message: `Subreddit r/${name} ${subreddit.is_active ? 'activated' : 'deactivated'}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/subreddits/performance/ranking - Get subreddits ranked by performance
router.get('/performance/ranking', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const subreddits = await SubredditConfig.find({})
      .sort({ 'performance_metrics.accuracy_rate': -1 })
      .limit(parseInt(limit));

    // Add performance scores
    const rankedSubreddits = subreddits.map((subreddit, index) => ({
      rank: index + 1,
      name: subreddit.name,
      display_name: subreddit.display_name,
      performance_score: subreddit.performance_score,
      metrics: subreddit.performance_metrics,
      is_active: subreddit.is_active,
      subscribers: subreddit.subscribers
    }));

    res.json({
      success: true,
      data: rankedSubreddits,
      metadata: {
        total_ranked: rankedSubreddits.length,
        limit: limit,
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

// POST /api/subreddits/bulk-update - Bulk update multiple subreddits
router.post('/bulk-update', async (req, res) => {
  try {
    const { updates } = req.body;
    
    if (!Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: 'Updates must be an array'
      });
    }

    const results = [];
    
    for (const update of updates) {
      try {
        const { name, ...updateData } = update;
        
        const subreddit = await SubredditConfig.findOneAndUpdate(
          { name: name.toLowerCase() },
          { 
            ...updateData,
            last_updated: new Date()
          },
          { new: true }
        );

        if (subreddit) {
          results.push({
            name: name,
            success: true,
            data: subreddit
          });
        } else {
          results.push({
            name: name,
            success: false,
            error: 'Subreddit not found'
          });
        }
      } catch (error) {
        results.push({
          name: update.name || 'unknown',
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    res.json({
      success: true,
      data: results,
      metadata: {
        total_requested: updates.length,
        successful: successCount,
        failed: updates.length - successCount,
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

// GET /api/subreddits/:name/metadata - Get detailed subreddit metadata
router.get('/:name/metadata', async (req, res) => {
  try {
    const { name } = req.params;
    
    const subreddit = await SubredditConfig.findOne({ 
      name: name.toLowerCase() 
    });

    if (!subreddit) {
      return res.status(404).json({
        success: false,
        error: `Subreddit r/${name} not found`
      });
    }

    // Get live metadata from Reddit
    const metadata = await redditService.getSubredditMetadata(name);
    
    // Update subreddit record with fresh data
    subreddit.subscribers = metadata.subscribers;
    subreddit.description = metadata.description;
    await subreddit.save();

    res.json({
      success: true,
      data: {
        config: subreddit,
        live_metadata: metadata
      },
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

// POST /api/subreddits/cross-validate - Cross-validate a ticker across subreddits
router.post('/cross-validate', async (req, res) => {
  try {
    const { ticker, timeframe = 24, subreddits } = req.body;
    
    if (!ticker) {
      return res.status(400).json({
        success: false,
        error: 'Ticker symbol is required'
      });
    }

    // Get active subreddits if none specified
    let targetSubreddits = subreddits;
    if (!targetSubreddits || targetSubreddits.length === 0) {
      const activeConfigs = await SubredditConfig.getActiveSubreddits();
      targetSubreddits = activeConfigs.map(s => s.name);
    }

    const validation = await redditService.validateSignalAcrossSubreddits(
      ticker, 
      targetSubreddits, 
      timeframe
    );

    res.json({
      success: true,
      data: validation,
      metadata: {
        ticker,
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

// POST /api/subreddits/recalculate-performance - Recalculate performance for all subreddits
router.post('/recalculate-performance', async (req, res) => {
  try {
    const { subreddits = [] } = req.body;
    
    let targetSubreddits;
    if (subreddits.length > 0) {
      targetSubreddits = await SubredditConfig.find({ 
        name: { $in: subreddits } 
      });
    } else {
      targetSubreddits = await SubredditConfig.find({});
    }

    const results = [];
    
    for (const subreddit of targetSubreddits) {
      try {
        await subreddit.calculatePerformance();
        results.push({
          name: subreddit.name,
          success: true,
          performance_score: subreddit.performance_score,
          metrics: subreddit.performance_metrics
        });
      } catch (error) {
        results.push({
          name: subreddit.name,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    res.json({
      success: true,
      data: results,
      metadata: {
        total_subreddits: targetSubreddits.length,
        successful: successCount,
        failed: targetSubreddits.length - successCount,
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

// GET /api/subreddits/monitoring/dashboard - Get monitoring dashboard data
router.get('/monitoring/dashboard', async (req, res) => {
  try {
    const dashboard = await monitoringService.getMonitoringDashboard();
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/subreddits/monitoring/start - Start automated monitoring
router.post('/monitoring/start', async (req, res) => {
  try {
    const { interval_minutes = 15 } = req.body;
    
    const started = await monitoringService.startMonitoring(interval_minutes);
    
    if (started) {
      res.json({
        success: true,
        message: `Automated monitoring started with ${interval_minutes} minute intervals`,
        status: monitoringService.getMonitoringStatus()
      });
    } else {
      res.json({
        success: false,
        message: 'Monitoring is already running',
        status: monitoringService.getMonitoringStatus()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/subreddits/monitoring/stop - Stop automated monitoring
router.post('/monitoring/stop', async (req, res) => {
  try {
    const stopped = monitoringService.stopMonitoring();
    
    if (stopped) {
      res.json({
        success: true,
        message: 'Automated monitoring stopped',
        status: monitoringService.getMonitoringStatus()
      });
    } else {
      res.json({
        success: false,
        message: 'Monitoring is not currently running',
        status: monitoringService.getMonitoringStatus()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/subreddits/monitoring/status - Get monitoring status
router.get('/monitoring/status', (req, res) => {
  try {
    const status = monitoringService.getMonitoringStatus();
    res.json({
      success: true,
      data: status,
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

// POST /api/subreddits/:name/enable - Enable monitoring for specific subreddit
router.post('/:name/enable', async (req, res) => {
  try {
    const { name } = req.params;
    const result = await monitoringService.enableSubredditMonitoring(name);
    
    res.json({
      success: true,
      data: result,
      metadata: {
        subreddit: name,
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

// POST /api/subreddits/:name/disable - Disable monitoring for specific subreddit
router.post('/:name/disable', async (req, res) => {
  try {
    const { name } = req.params;
    const result = await monitoringService.disableSubredditMonitoring(name);
    
    res.json({
      success: true,
      data: result,
      metadata: {
        subreddit: name,
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

// POST /api/subreddits/monitoring/bulk-toggle - Bulk enable/disable monitoring
router.post('/monitoring/bulk-toggle', async (req, res) => {
  try {
    const { subreddits, enable = true } = req.body;
    
    if (!Array.isArray(subreddits)) {
      return res.status(400).json({
        success: false,
        error: 'Subreddits must be an array'
      });
    }

    const result = await monitoringService.bulkToggleMonitoring(subreddits, enable);
    
    res.json({
      success: true,
      data: result,
      metadata: {
        action: enable ? 'enabled' : 'disabled',
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

// POST /api/subreddits/monitoring/process-now - Trigger immediate processing cycle
router.post('/monitoring/process-now', async (req, res) => {
  try {
    const result = await monitoringService.processActiveSubreddits();
    
    res.json({
      success: true,
      data: result,
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

module.exports = router;
