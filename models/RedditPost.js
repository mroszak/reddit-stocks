const mongoose = require('mongoose');

const redditPostSchema = new mongoose.Schema({
  // Reddit post identification
  reddit_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  subreddit: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 500
  },
  content: {
    type: String,
    default: ''
  },
  url: {
    type: String,
    default: ''
  },
  
  // Author information
  author: {
    type: String,
    required: true,
    index: true
  },
  author_flair: {
    type: String,
    default: ''
  },
  
  // Post metrics
  upvotes: {
    type: Number,
    default: 0,
    min: 0
  },
  upvote_ratio: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  comments: {
    type: Number,
    default: 0,
    min: 0
  },
  awards: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Timestamps
  created_utc: {
    type: Date,
    required: true,
    index: true
  },
  collected_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Analysis results
  tickers: [{
    symbol: {
      type: String,
      required: true,
      uppercase: true
    },
    mentions: {
      type: Number,
      default: 1,
      min: 1
    },
    confidence: {
      type: Number,
      default: 0.5,
      min: 0,
      max: 1
    }
  }],
  
  // Sentiment analysis
  sentiment_score: {
    type: Number,
    default: 0,
    min: -100,
    max: 100
  },
  sentiment_confidence: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  sentiment_keywords: [{
    word: String,
    weight: Number
  }],
  
  // Phase 3: Claude AI Analysis
  claude_analysis: {
    sentiment_score: {
      type: Number,
      min: -100,
      max: 100
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100
    },
    reasoning: String,
    key_factors: [String],
    bullish_indicators: [String],
    bearish_indicators: [String],
    sarcasm_detected: {
      type: Boolean,
      default: false
    },
    manipulation_risk: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    analysis_type: {
      type: String,
      enum: ['claude', 'keyword', 'hybrid'],
      default: 'keyword'
    },
    last_analyzed: Date
  },
  
  // Phase 3: Content Quality Assessment
  content_quality: {
    quality_score: {
      type: Number,
      min: 0,
      max: 100
    },
    content_type: {
      type: String,
      enum: ['DD', 'meme', 'news', 'question', 'discussion', 'spam'],
      default: 'discussion'
    },
    analysis_depth: {
      type: Number,
      min: 0,
      max: 100
    },
    credibility: {
      type: Number,
      min: 0,
      max: 100
    },
    educational_value: {
      type: Number,
      min: 0,
      max: 100
    },
    spam_likelihood: {
      type: Number,
      min: 0,
      max: 100
    },
    key_strengths: [String],
    key_weaknesses: [String],
    assessment_type: {
      type: String,
      enum: ['claude', 'heuristic'],
      default: 'heuristic'
    }
  },
  
  // Quality scoring
  quality_score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  user_quality_score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Noise filtering flags
  is_spam: {
    type: Boolean,
    default: false
  },
  is_bot: {
    type: Boolean,
    default: false
  },
  passes_noise_filter: {
    type: Boolean,
    default: true
  },
  
  // Time decay weighting
  time_decay_factor: {
    type: Number,
    default: 1.0,
    min: 0,
    max: 1
  },
  relevance_score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Phase 3: External Data Correlation
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
    articles_analyzed: {
      type: Number,
      default: 0
    },
    last_checked: Date
  },
  
  economic_context: {
    correlation_score: {
      type: Number,
      min: 0,
      max: 100
    },
    economic_support: {
      type: String,
      enum: ['favorable', 'neutral', 'unfavorable', 'unknown']
    },
    risk_factors: [String],
    opportunities: [String],
    last_assessed: Date
  },
  
  // Phase 3: Enhanced Confidence Scoring
  confidence_metrics: {
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
      data_points: Number,
      user_reputation: Number,
      cross_validation: Number,
      historical_accuracy: Number,
      news_correlation: Number,
      economic_context: Number
    },
    risk_factors: [{
      type: String,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical']
      },
      description: String
    }],
    last_calculated: Date
  },
  
  // Processing flags
  processed: {
    type: Boolean,
    default: false
  },
  processing_errors: [String],
  phase3_processed: {
    type: Boolean,
    default: false
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
redditPostSchema.index({ subreddit: 1, created_utc: -1 });
redditPostSchema.index({ 'tickers.symbol': 1, created_utc: -1 });
redditPostSchema.index({ author: 1, created_utc: -1 });
redditPostSchema.index({ quality_score: -1, sentiment_score: -1 });
redditPostSchema.index({ passes_noise_filter: 1, processed: 1 });

// Virtual for calculating post age in hours
redditPostSchema.virtual('age_hours').get(function() {
  return (Date.now() - this.created_utc.getTime()) / (1000 * 60 * 60);
});

// Virtual for weighted score calculation
redditPostSchema.virtual('weighted_sentiment').get(function() {
  return this.sentiment_score * this.time_decay_factor * (this.quality_score / 100);
});

// Method to update time decay factor
redditPostSchema.methods.updateTimeDecay = function() {
  const ageHours = this.age_hours;
  // Exponential decay: newer posts have higher weight
  this.time_decay_factor = Math.exp(-ageHours / 24); // Half-life of 24 hours
  return this.time_decay_factor;
};

// Method to check if post passes noise filter
redditPostSchema.methods.checkNoiseFilter = function(minUpvotes = 5, minComments = 2) {
  this.passes_noise_filter = (
    this.upvotes >= minUpvotes &&
    this.comments >= minComments &&
    !this.is_spam &&
    !this.is_bot &&
    this.tickers.length > 0
  );
  return this.passes_noise_filter;
};

// Static method to get trending tickers
redditPostSchema.statics.getTrendingTickers = async function(timeframe = 24) {
  const cutoffTime = new Date(Date.now() - timeframe * 60 * 60 * 1000);
  
  return this.aggregate([
    {
      $match: {
        created_utc: { $gte: cutoffTime },
        passes_noise_filter: true,
        processed: true
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
        unique_authors: { $addToSet: '$author' }
      }
    },
    {
      $addFields: {
        author_count: { $size: '$unique_authors' },
        trending_score: {
          $multiply: [
            '$mention_count',
            { $divide: ['$avg_sentiment', 100] },
            { $divide: ['$avg_quality', 100] }
          ]
        }
      }
    },
    { $sort: { trending_score: -1 } },
    { $limit: 50 }
  ]);
};

module.exports = mongoose.model('RedditPost', redditPostSchema);
