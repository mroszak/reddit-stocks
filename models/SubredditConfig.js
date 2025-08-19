const mongoose = require('mongoose');

const subredditConfigSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[a-zA-Z0-9_]{1,21}$/.test(v);
      },
      message: 'Invalid subreddit name format'
    }
  },
  display_name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  subscribers: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Configuration flags
  is_active: {
    type: Boolean,
    default: true
  },
  is_public: {
    type: Boolean,
    default: true
  },
  
  // Timestamps
  added_date: {
    type: Date,
    default: Date.now
  },
  last_updated: {
    type: Date,
    default: Date.now
  },
  last_scraped: {
    type: Date,
    default: null
  },
  
  // Filtering configuration
  config: {
    min_upvotes: {
      type: Number,
      default: 5,
      min: 0
    },
    min_comments: {
      type: Number,
      default: 2,
      min: 0
    },
    quality_threshold: {
      type: Number,
      default: 30,
      min: 0,
      max: 100
    },
    max_posts_per_hour: {
      type: Number,
      default: 100,
      min: 1
    },
    keywords_filter: [{
      type: String,
      lowercase: true
    }],
    exclude_flairs: [{
      type: String,
      lowercase: true
    }],
    include_flairs: [{
      type: String,
      lowercase: true
    }],
    min_account_age_days: {
      type: Number,
      default: 30,
      min: 0
    },
    min_karma: {
      type: Number,
      default: 100,
      min: 0
    }
  },
  
  // Performance tracking
  performance_metrics: {
    total_posts_processed: {
      type: Number,
      default: 0,
      min: 0
    },
    posts_last_24h: {
      type: Number,
      default: 0,
      min: 0
    },
    successful_predictions: {
      type: Number,
      default: 0,
      min: 0
    },
    total_predictions: {
      type: Number,
      default: 0,
      min: 0
    },
    accuracy_rate: {
      type: Number,
      default: 0,
      min: 0,
      max: 1
    },
    avg_sentiment_accuracy: {
      type: Number,
      default: 0,
      min: 0,
      max: 1
    },
    avg_quality_score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    noise_filter_ratio: {
      type: Number,
      default: 0,
      min: 0,
      max: 1
    },
    last_calculated: {
      type: Date,
      default: Date.now
    }
  },
  
  // Rate limiting tracking
  rate_limiting: {
    requests_today: {
      type: Number,
      default: 0,
      min: 0
    },
    last_request: {
      type: Date,
      default: null
    },
    rate_limit_reset: {
      type: Date,
      default: null
    },
    is_rate_limited: {
      type: Boolean,
      default: false
    }
  },
  
  // Error tracking
  errors: [{
    error_type: String,
    error_message: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    resolved: {
      type: Boolean,
      default: false
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
subredditConfigSchema.index({ name: 1 });
subredditConfigSchema.index({ is_active: 1, last_scraped: 1 });
subredditConfigSchema.index({ 'performance_metrics.accuracy_rate': -1 });

// Virtual for full subreddit name
subredditConfigSchema.virtual('full_name').get(function() {
  return `r/${this.name}`;
});

// Virtual for performance score
subredditConfigSchema.virtual('performance_score').get(function() {
  const metrics = this.performance_metrics;
  if (metrics.total_predictions === 0) return 0;
  
  return (
    metrics.accuracy_rate * 0.4 +
    metrics.avg_sentiment_accuracy * 0.3 +
    (metrics.avg_quality_score / 100) * 0.2 +
    metrics.noise_filter_ratio * 0.1
  ) * 100;
});

// Method to check if subreddit can be scraped
subredditConfigSchema.methods.canScrape = function() {
  if (!this.is_active) return false;
  if (this.rate_limiting.is_rate_limited) return false;
  
  const now = new Date();
  const lastRequest = this.rate_limiting.last_request;
  
  if (!lastRequest) return true;
  
  // Check if enough time has passed since last request
  const timeSinceLastRequest = now - lastRequest;
  const minInterval = (60 * 60 * 1000) / this.config.max_posts_per_hour; // ms between requests
  
  return timeSinceLastRequest >= minInterval;
};

// Method to update rate limiting
subredditConfigSchema.methods.updateRateLimit = function() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Reset daily counter if it's a new day
  if (!this.rate_limiting.last_request || this.rate_limiting.last_request < startOfDay) {
    this.rate_limiting.requests_today = 0;
  }
  
  this.rate_limiting.requests_today += 1;
  this.rate_limiting.last_request = now;
  
  // Check if we've hit the daily limit
  const dailyLimit = this.config.max_posts_per_hour * 24;
  this.rate_limiting.is_rate_limited = this.rate_limiting.requests_today >= dailyLimit;
  
  if (this.rate_limiting.is_rate_limited) {
    // Set reset time to next day
    this.rate_limiting.rate_limit_reset = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  }
};

// Method to calculate performance metrics
subredditConfigSchema.methods.calculatePerformance = async function() {
  const RedditPost = mongoose.model('RedditPost');
  const StockData = mongoose.model('StockData');
  const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last week
  
  // Get posts from this subreddit in the last 24 hours and week
  const recentPosts = await RedditPost.find({
    subreddit: this.name,
    created_utc: { $gte: cutoffTime },
    processed: true
  });

  const weeklyPosts = await RedditPost.find({
    subreddit: this.name,
    created_utc: { $gte: weekAgo },
    processed: true,
    'tickers.0': { $exists: true } // Posts with ticker mentions
  });
  
  this.performance_metrics.posts_last_24h = recentPosts.length;
  this.performance_metrics.total_posts_processed += recentPosts.length;
  
  if (recentPosts.length > 0) {
    const totalQuality = recentPosts.reduce((sum, post) => sum + post.quality_score, 0);
    this.performance_metrics.avg_quality_score = totalQuality / recentPosts.length;
    
    const passingFilter = recentPosts.filter(post => post.passes_noise_filter);
    this.performance_metrics.noise_filter_ratio = passingFilter.length / recentPosts.length;
  }

  // Calculate sentiment accuracy by comparing with actual stock performance
  if (weeklyPosts.length > 0) {
    let accurateePredictions = 0;
    let totalPredictions = 0;

    for (const post of weeklyPosts) {
      if (post.tickers && post.tickers.length > 0) {
        for (const ticker of post.tickers) {
          const stockData = await StockData.findOne({ ticker: ticker.symbol });
          if (stockData && stockData.price_data && stockData.price_data.length >= 2) {
            const postDate = post.created_utc;
            const priceData = stockData.price_data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            // Find price data around the post time
            const postPrice = priceData.find(p => new Date(p.timestamp) >= postDate);
            const futurePrice = priceData.find(p => 
              new Date(p.timestamp) >= new Date(postDate.getTime() + 24 * 60 * 60 * 1000)
            );

            if (postPrice && futurePrice) {
              const priceChange = (futurePrice.close - postPrice.close) / postPrice.close;
              const sentimentDirection = post.sentiment_score > 0 ? 1 : -1;
              const priceDirection = priceChange > 0.02 ? 1 : priceChange < -0.02 ? -1 : 0;

              totalPredictions++;
              if (sentimentDirection === priceDirection) {
                accurateePredictions++;
              }
            }
          }
        }
      }
    }

    if (totalPredictions > 0) {
      this.performance_metrics.successful_predictions = accurateePredictions;
      this.performance_metrics.total_predictions = totalPredictions;
      this.performance_metrics.accuracy_rate = accurateePredictions / totalPredictions;
    }
  }
  
  this.performance_metrics.last_calculated = new Date();
  await this.save();
};

// Static method to get active subreddits
subredditConfigSchema.statics.getActiveSubreddits = function() {
  return this.find({ 
    is_active: true,
    'rate_limiting.is_rate_limited': { $ne: true }
  }).sort({ 'performance_metrics.accuracy_rate': -1 });
};

// Static method to get default subreddits for initialization
subredditConfigSchema.statics.getDefaultSubreddits = function() {
  return [
    {
      name: 'stocks',
      display_name: 'Stocks',
      description: 'A community for stock market discussion',
      subscribers: 2800000,
      config: {
        min_upvotes: 10,
        min_comments: 5,
        quality_threshold: 40,
        max_posts_per_hour: 50
      }
    },
    {
      name: 'investing',
      display_name: 'Investing',
      description: 'Investment discussion and advice',
      subscribers: 1800000,
      config: {
        min_upvotes: 15,
        min_comments: 8,
        quality_threshold: 50,
        max_posts_per_hour: 30
      }
    },
    {
      name: 'stockmarket',
      display_name: 'Stock Market',
      description: 'Stock market news and discussion',
      subscribers: 5000000,
      config: {
        min_upvotes: 20,
        min_comments: 10,
        quality_threshold: 45,
        max_posts_per_hour: 60
      }
    },
    {
      name: 'securityanalysis',
      display_name: 'Security Analysis',
      description: 'Fundamental analysis and value investing',
      subscribers: 180000,
      config: {
        min_upvotes: 5,
        min_comments: 3,
        quality_threshold: 60,
        max_posts_per_hour: 20
      }
    },
    {
      name: 'valueinvesting',
      display_name: 'Value Investing',
      description: 'Value investing strategies and discussion',
      subscribers: 200000,
      config: {
        min_upvotes: 5,
        min_comments: 3,
        quality_threshold: 65,
        max_posts_per_hour: 15
      }
    },
    {
      name: 'wallstreetbets',
      display_name: 'Wall Street Bets',
      description: 'High-risk investment discussion',
      subscribers: 15000000,
      config: {
        min_upvotes: 50,
        min_comments: 20,
        quality_threshold: 25,
        max_posts_per_hour: 200,
        exclude_flairs: ['shitpost', 'meme']
      }
    },
    {
      name: 'pennystocks',
      display_name: 'Penny Stocks',
      description: 'Discussion of penny stock investments',
      subscribers: 2000000,
      config: {
        min_upvotes: 10,
        min_comments: 5,
        quality_threshold: 35,
        max_posts_per_hour: 80
      }
    }
  ];
};

module.exports = mongoose.model('SubredditConfig', subredditConfigSchema);
