const mongoose = require('mongoose');

const priceDataSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    required: true
  },
  open: {
    type: Number,
    required: true,
    min: 0
  },
  high: {
    type: Number,
    required: true,
    min: 0
  },
  low: {
    type: Number,
    required: true,
    min: 0
  },
  close: {
    type: Number,
    required: true,
    min: 0
  },
  volume: {
    type: Number,
    required: true,
    min: 0
  },
  adjusted_close: {
    type: Number,
    min: 0
  }
}, { _id: false });

const stockDataSchema = new mongoose.Schema({
  ticker: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    index: true,
    validate: {
      validator: function(v) {
        return /^[A-Z]{1,5}$/.test(v);
      },
      message: 'Invalid ticker symbol format'
    }
  },
  
  // Company information
  company_name: {
    type: String,
    default: ''
  },
  sector: {
    type: String,
    default: ''
  },
  industry: {
    type: String,
    default: ''
  },
  market_cap: {
    type: Number,
    min: 0
  },
  
  // Current price information
  current_price: {
    type: Number,
    min: 0
  },
  price_change: {
    type: Number
  },
  price_change_percent: {
    type: Number
  },
  
  // Historical price data (last 100 data points for performance)
  price_data: {
    type: [priceDataSchema],
    validate: {
      validator: function(v) {
        return v.length <= 100;
      },
      message: 'Price data array cannot exceed 100 entries'
    }
  },
  
  // Reddit mention tracking
  reddit_mentions: {
    total: {
      type: Number,
      default: 0,
      min: 0
    },
    last_24h: {
      type: Number,
      default: 0,
      min: 0
    },
    last_7d: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Sentiment tracking
  sentiment_trend: {
    current: {
      type: Number,
      default: 0,
      min: -100,
      max: 100
    },
    previous_24h: {
      type: Number,
      default: 0,
      min: -100,
      max: 100
    },
    change: {
      type: Number,
      default: 0
    },
    confidence: {
      type: Number,
      default: 0,
      min: 0,
      max: 1
    }
  },
  
  // Quality metrics
  quality_mentions: {
    type: Number,
    default: 0,
    min: 0
  },
  expert_mentions: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Trending metrics
  trending_score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  momentum_score: {
    type: Number,
    default: 0,
    min: -100,
    max: 100
  },
  
  // Cross-validation
  subreddit_mentions: [{
    subreddit: String,
    mentions: {
      type: Number,
      default: 0
    },
    sentiment: {
      type: Number,
      default: 0
    }
  }],
  
  // Technical indicators (will be populated by AlphaVantage)
  technical_indicators: {
    sma_20: Number,
    sma_50: Number,
    rsi: Number,
    macd: Number,
    bollinger_upper: Number,
    bollinger_lower: Number
  },
  
  // Phase 3: Enhanced Sentiment Analysis
  claude_sentiment: {
    current_score: {
      type: Number,
      min: -100,
      max: 100
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100
    },
    manipulation_risk: {
      type: Number,
      min: 0,
      max: 100
    },
    key_factors: [String],
    bullish_indicators: [String],
    bearish_indicators: [String],
    last_analyzed: Date
  },
  
  // Phase 3: News Correlation
  news_correlation: {
    correlation_score: {
      type: Number,
      min: 0,
      max: 100
    },
    correlation_type: {
      type: String,
      enum: ['positive_aligned', 'negative_aligned', 'divergent', 'mixed', 'no_data']
    },
    news_sentiment: Number,
    articles_count: {
      type: Number,
      default: 0
    },
    divergence_alerts: [{
      type: String,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high']
      },
      detected_at: Date
    }],
    last_updated: Date
  },
  
  // Phase 3: Economic Context
  economic_context: {
    correlation_score: {
      type: Number,
      min: 0,
      max: 100
    },
    economic_support: {
      type: String,
      enum: ['favorable', 'neutral', 'unfavorable', 'unknown'],
      default: 'unknown'
    },
    market_context: {
      interest_rate_environment: String,
      inflation_trend: String,
      economic_growth: String,
      market_sentiment: String,
      sector_rotation_signals: [String]
    },
    risk_factors: [String],
    opportunities: [String],
    recommendation: {
      action: {
        type: String,
        enum: ['strong_buy', 'buy', 'hold', 'weak_sell', 'sell']
      },
      confidence: {
        type: Number,
        min: 0,
        max: 100
      }
    },
    last_assessed: Date
  },
  
  // Phase 3: Enhanced Confidence Scoring
  confidence_analysis: {
    overall_confidence: {
      type: Number,
      min: 0,
      max: 100
    },
    confidence_level: {
      type: String,
      enum: ['very_high', 'high', 'medium', 'low', 'very_low']
    },
    component_scores: {
      data_points: {
        type: Number,
        min: 0,
        max: 100
      },
      user_reputation: {
        type: Number,
        min: 0,
        max: 100
      },
      cross_validation: {
        type: Number,
        min: 0,
        max: 100
      },
      historical_accuracy: {
        type: Number,
        min: 0,
        max: 100
      },
      news_correlation: {
        type: Number,
        min: 0,
        max: 100
      },
      economic_context: {
        type: Number,
        min: 0,
        max: 100
      }
    },
    strengths: [String],
    weaknesses: [String],
    risk_factors: [{
      type: String,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical']
      },
      description: String
    }],
    recommendations: [{
      type: {
        type: String,
        enum: ['action', 'caution', 'warning', 'risk_management', 'data_collection', 'validation']
      },
      priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical']
      },
      message: String
    }],
    last_calculated: Date
  },
  
  // Phase 3: User Reputation Analytics
  user_analytics: {
    top_contributors: [{
      username: String,
      quality_score: Number,
      reputation_tier: String,
      prediction_accuracy: Number,
      mentions_count: Number
    }],
    expert_consensus: {
      score: {
        type: Number,
        min: -100,
        max: 100
      },
      confidence: {
        type: Number,
        min: 0,
        max: 100
      },
      expert_count: Number
    },
    manipulation_detection: {
      risk_level: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low'
      },
      detected_patterns: [String],
      suspicious_activity_count: {
        type: Number,
        default: 0
      }
    },
    last_analyzed: Date
  },
  
  // Analysis flags
  is_trending: {
    type: Boolean,
    default: false
  },
  has_unusual_activity: {
    type: Boolean,
    default: false
  },
  is_penny_stock: {
    type: Boolean,
    default: false
  },
  is_cross_validated: {
    type: Boolean,
    default: false
  },
  has_high_confidence: {
    type: Boolean,
    default: false
  },
  
  // Data freshness tracking
  last_price_update: {
    type: Date,
    default: null
  },
  last_reddit_update: {
    type: Date,
    default: null
  },
  last_sentiment_update: {
    type: Date,
    default: null
  },
  last_updated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
stockDataSchema.index({ trending_score: -1 });
stockDataSchema.index({ 'reddit_mentions.last_24h': -1 });
stockDataSchema.index({ is_trending: 1, momentum_score: -1 });
stockDataSchema.index({ last_updated: -1 });

// Virtual for calculating price momentum
stockDataSchema.virtual('price_momentum').get(function() {
  if (this.price_data.length < 2) return 0;
  
  const recent = this.price_data.slice(-5); // Last 5 data points
  const older = this.price_data.slice(-10, -5); // Previous 5 data points
  
  if (older.length === 0) return 0;
  
  const recentAvg = recent.reduce((sum, p) => sum + p.close, 0) / recent.length;
  const olderAvg = older.reduce((sum, p) => sum + p.close, 0) / older.length;
  
  return ((recentAvg - olderAvg) / olderAvg) * 100;
});

// Virtual for volume momentum
stockDataSchema.virtual('volume_momentum').get(function() {
  if (this.price_data.length < 2) return 0;
  
  const recent = this.price_data.slice(-5);
  const older = this.price_data.slice(-10, -5);
  
  if (older.length === 0) return 0;
  
  const recentAvgVol = recent.reduce((sum, p) => sum + p.volume, 0) / recent.length;
  const olderAvgVol = older.reduce((sum, p) => sum + p.volume, 0) / older.length;
  
  return ((recentAvgVol - olderAvgVol) / olderAvgVol) * 100;
});

// Method to add new price data
stockDataSchema.methods.addPriceData = function(pricePoint) {
  this.price_data.push(pricePoint);
  
  // Keep only last 100 data points for performance
  if (this.price_data.length > 100) {
    this.price_data = this.price_data.slice(-100);
  }
  
  // Update current price information
  this.current_price = pricePoint.close;
  
  if (this.price_data.length >= 2) {
    const previousClose = this.price_data[this.price_data.length - 2].close;
    this.price_change = pricePoint.close - previousClose;
    this.price_change_percent = (this.price_change / previousClose) * 100;
  }
  
  this.last_price_update = new Date();
};

// Method to update Reddit mentions
stockDataSchema.methods.updateRedditMentions = function(mentions24h, mentionsTotal) {
  this.reddit_mentions.last_24h = mentions24h;
  this.reddit_mentions.total = mentionsTotal;
  this.last_reddit_update = new Date();
};

// Method to update sentiment
stockDataSchema.methods.updateSentiment = function(newSentiment, confidence) {
  this.sentiment_trend.previous_24h = this.sentiment_trend.current;
  this.sentiment_trend.current = newSentiment;
  this.sentiment_trend.change = newSentiment - this.sentiment_trend.previous_24h;
  this.sentiment_trend.confidence = confidence;
  this.last_sentiment_update = new Date();
};

// Method to calculate trending score
stockDataSchema.methods.calculateTrendingScore = function() {
  const mentionVolume = Math.min(100, (this.reddit_mentions.last_24h / 100) * 100);
  const sentimentMomentum = Math.abs(this.sentiment_trend.change) * 2;
  const qualityRatio = this.reddit_mentions.total > 0 ? 
    (this.quality_mentions / this.reddit_mentions.total) * 100 : 0;
  const crossSubredditScore = Math.min(100, this.subreddit_mentions.length * 20);
  
  // Time decay factor (newer activity weighted higher)
  const hoursAgo = this.last_reddit_update ? 
    (Date.now() - this.last_reddit_update.getTime()) / (1000 * 60 * 60) : 24;
  const timeDecayFactor = Math.exp(-hoursAgo / 12) * 100; // 12-hour half-life
  
  this.trending_score = (
    mentionVolume * 0.2 +
    sentimentMomentum * 0.25 +
    qualityRatio * 0.3 +
    crossSubredditScore * 0.15 +
    timeDecayFactor * 0.1
  );
  
  this.is_trending = this.trending_score > 60;
  
  return this.trending_score;
};

// Method to calculate momentum score
stockDataSchema.methods.calculateMomentumScore = function() {
  const recentSentiment = this.sentiment_trend.current * 0.4;
  const sentimentVelocity = this.sentiment_trend.change * 0.3;
  const volumeSpike = Math.min(100, this.volume_momentum) * 0.3;
  
  this.momentum_score = recentSentiment + sentimentVelocity + volumeSpike;
  this.momentum_score = Math.max(-100, Math.min(100, this.momentum_score));
  
  return this.momentum_score;
};

// Method to check for unusual activity
stockDataSchema.methods.checkUnusualActivity = function() {
  const volumeThreshold = 300; // 300% increase in volume
  const mentionThreshold = 500; // 500% increase in mentions
  
  this.has_unusual_activity = (
    this.volume_momentum > volumeThreshold ||
    this.reddit_mentions.last_24h > mentionThreshold
  );
  
  return this.has_unusual_activity;
};

// Static method to get trending stocks
stockDataSchema.statics.getTrendingStocks = function(limit = 20) {
  return this.find({
    'reddit_mentions.last_24h': { $gte: 5 },
    trending_score: { $gte: 40 }
  })
  .sort({ trending_score: -1, momentum_score: -1 })
  .limit(limit);
};

// Static method to get stocks by sentiment
stockDataSchema.statics.getStocksBySentiment = function(minSentiment = 50, limit = 20) {
  return this.find({
    'sentiment_trend.current': { $gte: minSentiment },
    'sentiment_trend.confidence': { $gte: 0.6 },
    'reddit_mentions.last_24h': { $gte: 3 }
  })
  .sort({ 'sentiment_trend.current': -1, trending_score: -1 })
  .limit(limit);
};

// Pre-save middleware to update calculated fields
stockDataSchema.pre('save', function(next) {
  // Check if it's a penny stock (< $5)
  if (this.current_price && this.current_price < 5) {
    this.is_penny_stock = true;
  }
  
  // Update trending and momentum scores if relevant data changed
  if (this.isModified('reddit_mentions') || this.isModified('sentiment_trend')) {
    this.calculateTrendingScore();
    this.calculateMomentumScore();
    this.checkUnusualActivity();
  }
  
  this.last_updated = Date.now();
  next();
});

module.exports = mongoose.model('StockData', stockDataSchema);
