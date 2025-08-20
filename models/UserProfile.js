const mongoose = require('mongoose');

const userProfileSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    index: true,
    maxlength: 20
  },
  
  // Reddit account information
  account_age: {
    type: Number, // Days since account creation
    required: true,
    min: 0
  },
  karma: {
    type: Number,
    default: 0
    // Allow negative karma values
  },
  comment_karma: {
    type: Number,
    default: 0
    // Allow negative karma values
  },
  link_karma: {
    type: Number,
    default: 0
    // Allow negative karma values
  },
  
  // Posting activity
  post_count: {
    type: Number,
    default: 0,
    min: 0
  },
  finance_post_count: {
    type: Number,
    default: 0,
    min: 0
  },
  finance_post_frequency: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  
  // Quality metrics
  accuracy_score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  reputation_tier: {
    type: String,
    enum: ['novice', 'intermediate', 'advanced', 'expert', 'legend'],
    default: 'novice'
  },
  quality_score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Analysis tracking
  predictions_made: {
    type: Number,
    default: 0,
    min: 0
  },
  correct_predictions: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Engagement metrics
  avg_upvotes: {
    type: Number,
    default: 0,
    min: 0
  },
  avg_comments: {
    type: Number,
    default: 0,
    min: 0
  },
  awards_received: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Behavioral flags
  is_bot: {
    type: Boolean,
    default: false
  },
  is_verified: {
    type: Boolean,
    default: false
  },
  is_suspicious: {
    type: Boolean,
    default: false
  },
  
  // Subreddit activity
  active_subreddits: [{
    name: String,
    post_count: {
      type: Number,
      default: 0
    },
    avg_score: {
      type: Number,
      default: 0
    }
  }],
  
  // Phase 3: Enhanced Reputation Analytics
  enhanced_reputation: {
    overall_score: {
      type: Number,
      min: 0,
      max: 100
    },
    prediction_accuracy: {
      accuracy_rate: {
        type: Number,
        min: 0,
        max: 100
      },
      total_predictions: {
        type: Number,
        default: 0
      },
      correct_predictions: {
        type: Number,
        default: 0
      },
      recent_performance: {
        type: String,
        enum: ['improving', 'stable', 'declining', 'insufficient_data']
      },
      confidence: {
        type: Number,
        min: 0,
        max: 100
      }
    },
    content_quality: {
      avg_quality: {
        type: Number,
        min: 0,
        max: 100
      },
      content_types: {
        DD: { type: Number, default: 0 },
        meme: { type: Number, default: 0 },
        news: { type: Number, default: 0 },
        question: { type: Number, default: 0 },
        discussion: { type: Number, default: 0 }
      },
      educational_value: {
        type: Number,
        min: 0,
        max: 100
      }
    },
    market_timing: {
      timing_score: {
        type: Number,
        min: 0,
        max: 100
      },
      market_cycle_awareness: {
        type: String,
        enum: ['contrarian_bullish', 'contrarian_bearish', 'trend_following', 'moderate', 'unknown']
      }
    },
    behavior_analysis: {
      trust_score: {
        type: Number,
        min: 0,
        max: 100
      },
      behavior_flags: [String],
      manipulation_risk: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'low'
      },
      economic_awareness: {
        score: {
          type: Number,
          min: 0,
          max: 100
        },
        mentions_ratio: Number
      }
    },
    sector_expertise: {
      max_expertise: {
        type: Number,
        min: 0,
        max: 100
      },
      top_sector: String,
      sectors_covered: {
        type: Number,
        default: 0
      },
      specialization_level: {
        type: String,
        enum: ['high', 'medium', 'low'],
        default: 'low'
      }
    },
    reputation_badges: [{
      name: String,
      icon: String,
      description: String,
      earned_at: {
        type: Date,
        default: Date.now
      }
    }],
    strengths: [String],
    areas_for_improvement: [String],
    last_calculated: Date
  },
  
  // Timestamps
  first_seen: {
    type: Date,
    default: Date.now
  },
  last_updated: {
    type: Date,
    default: Date.now
  },
  last_post_analyzed: {
    type: Date,
    default: null
  },
  last_reputation_update: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
userProfileSchema.index({ quality_score: -1 });
userProfileSchema.index({ reputation_tier: 1, accuracy_score: -1 });
userProfileSchema.index({ is_bot: 1, is_suspicious: 1 });

// Virtual for accuracy percentage
userProfileSchema.virtual('accuracy_percentage').get(function() {
  if (this.predictions_made === 0) return 0;
  return (this.correct_predictions / this.predictions_made) * 100;
});

// Virtual for engagement score
userProfileSchema.virtual('engagement_score').get(function() {
  return Math.min(100, (this.avg_upvotes * 0.6) + (this.avg_comments * 0.4));
});

// Method to calculate quality score
userProfileSchema.methods.calculateQualityScore = function() {
  // Quality score algorithm from architecture document
  const accountAgeScore = Math.min(100, this.account_age / 365 * 100); // Max score at 1 year
  const karmaScore = Math.min(100, Math.log10(Math.max(1, this.karma + 1)) * 20); // Logarithmic scaling, handle negative karma
  const financeFreqScore = this.finance_post_frequency * 100;
  const accuracyScore = this.accuracy_score;
  
  this.quality_score = (
    accountAgeScore * 0.2 +
    karmaScore * 0.3 +
    financeFreqScore * 0.3 +
    accuracyScore * 0.2
  );
  
  return this.quality_score;
};

// Method to update reputation tier
userProfileSchema.methods.updateReputationTier = function() {
  const score = this.quality_score;
  
  if (score >= 90) {
    this.reputation_tier = 'legend';
  } else if (score >= 80) {
    this.reputation_tier = 'expert';
  } else if (score >= 65) {
    this.reputation_tier = 'advanced';
  } else if (score >= 45) {
    this.reputation_tier = 'intermediate';
  } else {
    this.reputation_tier = 'novice';
  }
  
  return this.reputation_tier;
};

// Method to check if user is suspicious
userProfileSchema.methods.checkSuspiciousActivity = function() {
  // Flag suspicious patterns
  const flags = [];
  
  // Very new account with high posting frequency
  if (this.account_age < 30 && this.post_count > 100) {
    flags.push('new_account_high_activity');
  }
  
  // High karma but low quality posts
  if (this.karma > 10000 && this.quality_score < 30) {
    flags.push('high_karma_low_quality');
  }
  
  // Extremely high posting frequency (bot-like)
  if (this.post_count / Math.max(1, this.account_age) > 10) {
    flags.push('extremely_high_frequency');
  }
  
  // Only posts in finance subreddits (potential shill)
  if (this.finance_post_frequency > 0.95 && this.post_count > 50) {
    flags.push('finance_only_posting');
  }
  
  this.is_suspicious = flags.length > 0;
  return { is_suspicious: this.is_suspicious, flags };
};

// Method to update finance posting frequency
userProfileSchema.methods.updateFinanceFrequency = function() {
  if (this.post_count === 0) {
    this.finance_post_frequency = 0;
  } else {
    this.finance_post_frequency = this.finance_post_count / this.post_count;
  }
  
  return this.finance_post_frequency;
};

// Static method to get top quality users
userProfileSchema.statics.getTopQualityUsers = function(limit = 50) {
  return this.find({
    is_bot: false,
    is_suspicious: false,
    quality_score: { $gte: 60 }
  })
  .sort({ quality_score: -1, accuracy_score: -1 })
  .limit(limit);
};

// Static method to get users by reputation tier
userProfileSchema.statics.getUsersByTier = function(tier) {
  return this.find({
    reputation_tier: tier,
    is_bot: false,
    is_suspicious: false
  }).sort({ quality_score: -1 });
};

// Pre-save middleware to update calculated fields
userProfileSchema.pre('save', function(next) {
  if (this.isModified('post_count') || this.isModified('finance_post_count')) {
    this.updateFinanceFrequency();
  }
  
  if (this.isModified('karma') || this.isModified('account_age') || 
      this.isModified('finance_post_frequency') || this.isModified('accuracy_score')) {
    this.calculateQualityScore();
    this.updateReputationTier();
  }
  
  this.checkSuspiciousActivity();
  this.last_updated = Date.now();
  
  next();
});

module.exports = mongoose.model('UserProfile', userProfileSchema);
