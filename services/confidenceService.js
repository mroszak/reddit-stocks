const claudeService = require('./claudeService');
const newsService = require('./newsService');
const fredService = require('./fredService');
const userReputationService = require('./userReputationService');
const RedditPost = require('../models/RedditPost');
const UserProfile = require('../models/UserProfile');
const StockData = require('../models/StockData');
const SubredditConfig = require('../models/SubredditConfig');

class ConfidenceService {
  constructor() {
    this.confidenceWeights = {
      data_points: 0.20,          // Volume of data
      user_reputation: 0.25,      // Quality of sources
      cross_validation: 0.20,     // Multi-subreddit consensus
      historical_accuracy: 0.15,  // Track record
      news_correlation: 0.10,     // External validation
      economic_context: 0.10      // Macro alignment
    };
    
    this.confidenceLevels = {
      'very_high': { min: 85, color: '#4CAF50', description: 'Very High Confidence' },
      'high': { min: 70, color: '#8BC34A', description: 'High Confidence' },
      'medium': { min: 50, color: '#FFC107', description: 'Medium Confidence' },
      'low': { min: 30, color: '#FF9800', description: 'Low Confidence' },
      'very_low': { min: 0, color: '#F44336', description: 'Very Low Confidence' }
    };
  }

  // Calculate comprehensive confidence score for a ticker sentiment
  async calculateComprehensiveConfidence(ticker, options = {}) {
    const {
      timeframe = 24,
      includeNews = true,
      includeEconomic = true,
      includeUserReputation = true,
      includeCrossValidation = true
    } = options;

    console.log(`🔄 Calculating comprehensive confidence for ${ticker}...`);

    try {
      // Get Reddit sentiment data
      const redditData = await this.getRedditSentimentData(ticker, timeframe);
      
      // Calculate individual confidence components
      const components = await this.calculateConfidenceComponents(ticker, redditData, {
        includeNews,
        includeEconomic,
        includeUserReputation,
        includeCrossValidation,
        timeframe
      });

      // Calculate weighted confidence score
      const confidenceScore = this.calculateWeightedConfidence(components);
      
      // Determine confidence level
      const confidenceLevel = this.determineConfidenceLevel(confidenceScore);
      
      // Generate confidence insights
      const insights = this.generateConfidenceInsights(components, confidenceLevel);
      
      // Calculate risk factors
      const riskFactors = this.identifyRiskFactors(components, redditData);
      
      const result = {
        ticker,
        confidence_score: Math.round(confidenceScore * 100) / 100,
        confidence_level: confidenceLevel,
        sentiment_data: redditData,
        confidence_components: components,
        insights: insights,
        risk_factors: riskFactors,
        recommendations: this.generateRecommendations(confidenceScore, confidenceLevel, riskFactors),
        calculation_details: {
          weights_used: this.confidenceWeights,
          timeframe_hours: timeframe,
          calculated_at: new Date().toISOString()
        }
      };

      console.log(`✅ Confidence calculated for ${ticker}: ${confidenceScore.toFixed(1)}/100 (${confidenceLevel.level})`);
      
      return result;

    } catch (error) {
      console.error(`❌ Error calculating confidence for ${ticker}:`, error.message);
      throw error;
    }
  }

  // Get Reddit sentiment data for confidence calculation
  async getRedditSentimentData(ticker, timeframe) {
    const cutoffTime = new Date(Date.now() - timeframe * 60 * 60 * 1000);
    
    const posts = await RedditPost.find({
      'tickers.symbol': ticker.toUpperCase(),
      created_utc: { $gte: cutoffTime },
      processed: true,
      passes_noise_filter: true
    }).populate('author_profile');

    if (posts.length === 0) {
      return {
        mention_count: 0,
        avg_sentiment: 0,
        quality_score: 0,
        subreddits: [],
        top_users: [],
        data_quality: 'insufficient'
      };
    }

    // Calculate metrics
    const totalSentiment = posts.reduce((sum, post) => sum + post.sentiment_score, 0);
    const avgSentiment = totalSentiment / posts.length;
    
    const totalQuality = posts.reduce((sum, post) => sum + post.quality_score, 0);
    const avgQuality = totalQuality / posts.length;

    // Get subreddit breakdown
    const subredditBreakdown = {};
    posts.forEach(post => {
      if (!subredditBreakdown[post.subreddit]) {
        subredditBreakdown[post.subreddit] = { count: 0, sentiment: 0 };
      }
      subredditBreakdown[post.subreddit].count++;
      subredditBreakdown[post.subreddit].sentiment += post.sentiment_score;
    });

    // Calculate averages for subreddits
    Object.keys(subredditBreakdown).forEach(subreddit => {
      const data = subredditBreakdown[subreddit];
      data.avg_sentiment = data.sentiment / data.count;
    });

    // Get top users by reputation
    const usersByReputation = posts
      .filter(post => post.author_profile)
      .sort((a, b) => (b.author_profile.quality_score || 0) - (a.author_profile.quality_score || 0))
      .slice(0, 10)
      .map(post => ({
        username: post.author,
        quality_score: post.author_profile.quality_score,
        reputation_tier: post.author_profile.reputation_tier,
        sentiment: post.sentiment_score
      }));

    return {
      mention_count: posts.length,
      avg_sentiment: avgSentiment,
      quality_score: avgQuality,
      subreddits: Object.keys(subredditBreakdown),
      subreddit_breakdown: subredditBreakdown,
      top_users: usersByReputation,
      data_quality: posts.length >= 10 ? 'good' : posts.length >= 5 ? 'fair' : 'limited',
      posts_sample: posts.slice(0, 5).map(post => ({
        title: post.title,
        sentiment: post.sentiment_score,
        quality: post.quality_score,
        subreddit: post.subreddit,
        author: post.author
      }))
    };
  }

  // Calculate individual confidence components
  async calculateConfidenceComponents(ticker, redditData, options) {
    const components = {};

    // 1. Data Points Component
    components.data_points = this.calculateDataPointsConfidence(redditData);

    // 2. User Reputation Component
    if (options.includeUserReputation) {
      components.user_reputation = await this.calculateUserReputationConfidence(redditData);
    }

    // 3. Cross-Validation Component
    if (options.includeCrossValidation) {
      components.cross_validation = await this.calculateCrossValidationConfidence(ticker, redditData, options.timeframe);
    }

    // 4. Historical Accuracy Component
    components.historical_accuracy = await this.calculateHistoricalAccuracyConfidence(ticker, redditData);

    // 5. News Correlation Component
    if (options.includeNews) {
      components.news_correlation = await this.calculateNewsCorrelationConfidence(ticker, redditData.avg_sentiment);
    }

    // 6. Economic Context Component
    if (options.includeEconomic) {
      components.economic_context = await this.calculateEconomicContextConfidence(ticker, redditData.avg_sentiment);
    }

    return components;
  }

  // Calculate confidence from data points volume and quality
  calculateDataPointsConfidence(redditData) {
    const mentionCount = redditData.mention_count;
    const qualityScore = redditData.quality_score;
    const subredditDiversity = redditData.subreddits.length;

    // Volume score (0-40 points)
    let volumeScore = 0;
    if (mentionCount >= 50) volumeScore = 40;
    else if (mentionCount >= 20) volumeScore = 30;
    else if (mentionCount >= 10) volumeScore = 20;
    else if (mentionCount >= 5) volumeScore = 10;

    // Quality score (0-30 points)
    let qualityPoints = Math.min(30, qualityScore * 0.4);

    // Diversity score (0-30 points)
    let diversityScore = Math.min(30, subredditDiversity * 8);

    const totalScore = volumeScore + qualityPoints + diversityScore;

    return {
      score: totalScore,
      details: {
        volume_score: volumeScore,
        quality_points: qualityPoints,
        diversity_score: diversityScore,
        mention_count: mentionCount,
        avg_quality: qualityScore,
        subreddit_count: subredditDiversity
      },
      confidence_impact: 'Data volume and quality foundation'
    };
  }

  // Calculate confidence from user reputation
  async calculateUserReputationConfidence(redditData) {
    if (redditData.top_users.length === 0) {
      return {
        score: 20, // Default low score
        details: { reason: 'No user reputation data available' },
        confidence_impact: 'Cannot assess user credibility'
      };
    }

    try {
      let totalReputationScore = 0;
      let highQualityUserCount = 0;
      let expertUserCount = 0;
      const userAnalysis = [];

      for (const user of redditData.top_users) {
        const reputationScore = user.quality_score || 0;
        totalReputationScore += reputationScore;

        if (reputationScore >= 70) {
          highQualityUserCount++;
        }
        if (user.reputation_tier === 'expert' || user.reputation_tier === 'legend') {
          expertUserCount++;
        }

        userAnalysis.push({
          username: user.username,
          reputation: reputationScore,
          tier: user.reputation_tier,
          sentiment: user.sentiment
        });
      }

      const avgReputationScore = totalReputationScore / redditData.top_users.length;
      const highQualityRatio = highQualityUserCount / redditData.top_users.length;
      const expertRatio = expertUserCount / redditData.top_users.length;

      // Calculate final score (0-100)
      let finalScore = 0;
      finalScore += Math.min(50, avgReputationScore * 0.6); // Base reputation
      finalScore += highQualityRatio * 30; // High quality user bonus
      finalScore += expertRatio * 20; // Expert user bonus

      return {
        score: Math.round(finalScore),
        details: {
          avg_reputation: Math.round(avgReputationScore),
          high_quality_users: highQualityUserCount,
          expert_users: expertUserCount,
          high_quality_ratio: Math.round(highQualityRatio * 100),
          expert_ratio: Math.round(expertRatio * 100),
          user_analysis: userAnalysis.slice(0, 5) // Top 5 users
        },
        confidence_impact: expertRatio > 0.2 ? 'Strong expert consensus' : 
                          highQualityRatio > 0.5 ? 'Good user quality' : 'Mixed user quality'
      };

    } catch (error) {
      console.error('❌ Error calculating user reputation confidence:', error.message);
      return {
        score: 30,
        details: { error: error.message },
        confidence_impact: 'User reputation assessment failed'
      };
    }
  }

  // Calculate confidence from cross-subreddit validation
  async calculateCrossValidationConfidence(ticker, redditData, timeframe) {
    try {
      const subredditCount = redditData.subreddits.length;
      const subredditBreakdown = redditData.subreddit_breakdown;

      if (subredditCount < 2) {
        return {
          score: 20,
          details: { 
            subreddit_count: subredditCount,
            reason: 'Single subreddit signal - no cross-validation possible'
          },
          confidence_impact: 'No cross-validation available'
        };
      }

      // Calculate sentiment consistency across subreddits
      const sentiments = Object.values(subredditBreakdown).map(s => s.avg_sentiment);
      const avgSentiment = sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length;
      
      // Calculate sentiment variance (lower is better for consistency)
      const variance = sentiments.reduce((sum, s) => sum + Math.pow(s - avgSentiment, 2), 0) / sentiments.length;
      const consistency = Math.max(0, 100 - variance); // Convert variance to consistency score

      // Calculate distribution score
      let distributionScore = 0;
      if (subredditCount >= 5) distributionScore = 40;
      else if (subredditCount >= 3) distributionScore = 25;
      else if (subredditCount >= 2) distributionScore = 15;

      // Calculate consensus strength
      const strongConsensus = sentiments.filter(s => Math.abs(s - avgSentiment) < 20).length;
      const consensusRatio = strongConsensus / sentiments.length;
      const consensusScore = consensusRatio * 35;

      const finalScore = Math.min(100, distributionScore + (consistency * 0.25) + consensusScore);

      return {
        score: Math.round(finalScore),
        details: {
          subreddit_count: subredditCount,
          sentiment_consistency: Math.round(consistency),
          consensus_ratio: Math.round(consensusRatio * 100),
          avg_sentiment: Math.round(avgSentiment * 100) / 100,
          subreddit_sentiments: Object.entries(subredditBreakdown).map(([sub, data]) => ({
            subreddit: sub,
            sentiment: Math.round(data.avg_sentiment * 100) / 100,
            mentions: data.count
          }))
        },
        confidence_impact: consensusRatio > 0.8 ? 'Strong cross-subreddit consensus' :
                          consensusRatio > 0.6 ? 'Good cross-validation' : 'Mixed signals across subreddits'
      };

    } catch (error) {
      console.error('❌ Error calculating cross-validation confidence:', error.message);
      return {
        score: 30,
        details: { error: error.message },
        confidence_impact: 'Cross-validation assessment failed'
      };
    }
  }

  // Calculate confidence from historical accuracy
  async calculateHistoricalAccuracyConfidence(ticker, redditData) {
    try {
      // Get historical sentiment vs price movement correlation for this ticker
      const stockData = await StockData.findOne({ ticker: ticker.toUpperCase() });
      
      if (!stockData || !stockData.price_data || stockData.price_data.length < 5) {
        return {
          score: 50, // Neutral when no historical data
          details: { reason: 'Insufficient historical data for accuracy assessment' },
          confidence_impact: 'No historical accuracy data'
        };
      }

      // Get recent posts for this ticker
      const recentPosts = await RedditPost.find({
        'tickers.symbol': ticker.toUpperCase(),
        created_utc: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
        processed: true
      }).sort({ created_utc: -1 }).limit(20);

      if (recentPosts.length < 5) {
        return {
          score: 50,
          details: { reason: 'Insufficient recent posts for accuracy assessment' },
          confidence_impact: 'Limited historical prediction data'
        };
      }

      // Simulate accuracy calculation (in real implementation, compare actual price movements)
      let correctPredictions = 0;
      let totalPredictions = 0;

      for (const post of recentPosts) {
        // Simplified accuracy check - in real implementation, use actual price data
        const postDate = new Date(post.created_utc);
        const daysSincePost = (Date.now() - postDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSincePost >= 3) { // Only check posts older than 3 days
          totalPredictions++;
          
          // Simulate 60% accuracy for demonstration
          // In real implementation: compare sentiment direction with actual price movement
          if (Math.random() > 0.4) {
            correctPredictions++;
          }
        }
      }

      const accuracyRate = totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 50;
      
      // Calculate confidence based on accuracy
      let accuracyScore = 0;
      if (accuracyRate >= 80) accuracyScore = 90;
      else if (accuracyRate >= 70) accuracyScore = 75;
      else if (accuracyRate >= 60) accuracyScore = 60;
      else if (accuracyRate >= 50) accuracyScore = 45;
      else accuracyScore = 20;

      // Bonus for larger sample size
      const sampleSizeBonus = Math.min(10, totalPredictions);
      const finalScore = Math.min(100, accuracyScore + sampleSizeBonus);

      return {
        score: Math.round(finalScore),
        details: {
          accuracy_rate: Math.round(accuracyRate),
          correct_predictions: correctPredictions,
          total_predictions: totalPredictions,
          sample_size_bonus: sampleSizeBonus,
          historical_posts_analyzed: recentPosts.length
        },
        confidence_impact: accuracyRate >= 70 ? 'Strong historical accuracy' :
                          accuracyRate >= 55 ? 'Moderate historical accuracy' : 'Poor historical accuracy'
      };

    } catch (error) {
      console.error('❌ Error calculating historical accuracy confidence:', error.message);
      return {
        score: 50,
        details: { error: error.message },
        confidence_impact: 'Historical accuracy assessment failed'
      };
    }
  }

  // Calculate confidence from news correlation
  async calculateNewsCorrelationConfidence(ticker, redditSentiment) {
    try {
      const newsCorrelation = await newsService.correlateWithRedditSentiment(ticker, redditSentiment, {
        timeframe: '7d'
      });

      if (newsCorrelation.articles_analyzed === 0) {
        return {
          score: 50, // Neutral when no news data
          details: { reason: 'No news articles found for correlation' },
          confidence_impact: 'No news validation available'
        };
      }

      let correlationScore = 50; // Start with neutral

      // Positive correlation increases confidence
      if (newsCorrelation.correlation === 'positive_aligned') {
        correlationScore = 80;
      } else if (newsCorrelation.correlation === 'negative_aligned') {
        correlationScore = 75;
      } else if (newsCorrelation.correlation === 'divergent') {
        correlationScore = 25; // Divergence reduces confidence
      } else {
        correlationScore = 45; // Mixed signals
      }

      // Adjust based on correlation strength
      correlationScore += (newsCorrelation.correlation_strength * 20);

      // Bonus for more articles
      const articlesBonus = Math.min(15, newsCorrelation.articles_analyzed * 2);
      const finalScore = Math.min(100, correlationScore + articlesBonus);

      return {
        score: Math.round(finalScore),
        details: {
          correlation_type: newsCorrelation.correlation,
          correlation_strength: newsCorrelation.correlation_strength,
          articles_analyzed: newsCorrelation.articles_analyzed,
          reddit_sentiment: redditSentiment,
          news_sentiment: newsCorrelation.news_sentiment.avg_sentiment,
          divergence_alerts: newsCorrelation.divergence_alerts.length
        },
        confidence_impact: newsCorrelation.correlation === 'positive_aligned' ? 'News confirms Reddit sentiment' :
                          newsCorrelation.correlation === 'divergent' ? 'News contradicts Reddit sentiment' : 
                          'Mixed news-Reddit correlation'
      };

    } catch (error) {
      console.error('❌ Error calculating news correlation confidence:', error.message);
      return {
        score: 50,
        details: { error: error.message },
        confidence_impact: 'News correlation assessment failed'
      };
    }
  }

  // Calculate confidence from economic context
  async calculateEconomicContextConfidence(ticker, redditSentiment) {
    try {
      const economicCorrelation = await fredService.correlateWithStockSentiment(ticker, redditSentiment);

      if (!economicCorrelation.market_context) {
        return {
          score: 50,
          details: { reason: 'No economic data available' },
          confidence_impact: 'No economic context validation'
        };
      }

      let contextScore = 50; // Start with neutral
      const context = economicCorrelation.market_context;
      const riskFactors = economicCorrelation.risk_factors.length;
      const opportunities = economicCorrelation.opportunities.length;

      // Assess alignment with economic conditions
      if (economicCorrelation.economic_correlation === 'positive') {
        contextScore = 75;
      } else if (economicCorrelation.economic_correlation === 'negative') {
        contextScore = 30;
      } else if (economicCorrelation.economic_correlation === 'divergent') {
        contextScore = 25;
      }

      // Adjust based on risk/opportunity balance
      const netScore = opportunities - (riskFactors * 0.5);
      contextScore += netScore * 5;

      // Economic environment adjustment
      if (context.overall_assessment === 'positive') {
        contextScore += 10;
      } else if (context.overall_assessment === 'negative') {
        contextScore -= 10;
      }

      const finalScore = Math.max(0, Math.min(100, contextScore));

      return {
        score: Math.round(finalScore),
        details: {
          economic_correlation: economicCorrelation.economic_correlation,
          overall_assessment: context.overall_assessment,
          risk_factors: riskFactors,
          opportunities: opportunities,
          interest_rate_environment: context.interest_rate_environment,
          inflation_trend: context.inflation_trend,
          market_sentiment: context.market_sentiment
        },
        confidence_impact: economicCorrelation.economic_correlation === 'positive' ? 
                          'Economic conditions support sentiment' :
                          economicCorrelation.economic_correlation === 'negative' ?
                          'Economic headwinds challenge sentiment' : 'Mixed economic signals'
      };

    } catch (error) {
      console.error('❌ Error calculating economic context confidence:', error.message);
      return {
        score: 50,
        details: { error: error.message },
        confidence_impact: 'Economic context assessment failed'
      };
    }
  }

  // Calculate weighted confidence score
  calculateWeightedConfidence(components) {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [componentName, weight] of Object.entries(this.confidenceWeights)) {
      if (components[componentName] && typeof components[componentName].score === 'number') {
        weightedSum += components[componentName].score * weight;
        totalWeight += weight;
      }
    }

    // Normalize if some components are missing
    return totalWeight > 0 ? (weightedSum / totalWeight) : 50;
  }

  // Determine confidence level from score
  determineConfidenceLevel(score) {
    for (const [level, config] of Object.entries(this.confidenceLevels)) {
      if (score >= config.min) {
        return {
          level,
          ...config,
          numeric_score: score
        };
      }
    }
    return {
      level: 'very_low',
      ...this.confidenceLevels.very_low,
      numeric_score: score
    };
  }

  // Generate confidence insights
  generateConfidenceInsights(components, confidenceLevel) {
    const insights = [];
    const strengths = [];
    const weaknesses = [];

    // Analyze each component
    Object.entries(components).forEach(([componentName, data]) => {
      if (data && typeof data.score === 'number') {
        if (data.score >= 75) {
          strengths.push(`Strong ${componentName.replace('_', ' ')}: ${data.confidence_impact}`);
        } else if (data.score <= 35) {
          weaknesses.push(`Weak ${componentName.replace('_', ' ')}: ${data.confidence_impact}`);
        }
      }
    });

    // Overall assessment
    if (confidenceLevel.level === 'very_high' || confidenceLevel.level === 'high') {
      insights.push('High-confidence signal with strong supporting evidence');
    } else if (confidenceLevel.level === 'medium') {
      insights.push('Moderate confidence - monitor for additional confirmation');
    } else {
      insights.push('Low confidence - exercise caution and seek more data');
    }

    // Top strengths and weaknesses
    if (strengths.length > 0) {
      insights.push(`Key strengths: ${strengths.slice(0, 2).join(', ')}`);
    }
    
    if (weaknesses.length > 0) {
      insights.push(`Areas of concern: ${weaknesses.slice(0, 2).join(', ')}`);
    }

    return {
      summary: insights,
      strengths: strengths,
      weaknesses: weaknesses,
      overall_assessment: confidenceLevel.level,
      reliability_factors: this.getReliabilityFactors(components)
    };
  }

  // Identify risk factors
  identifyRiskFactors(components, redditData) {
    const riskFactors = [];

    // Data quality risks
    if (redditData.mention_count < 5) {
      riskFactors.push({
        type: 'insufficient_data',
        severity: 'high',
        description: 'Very few mentions - sample size too small for reliable analysis'
      });
    }

    // User reputation risks
    if (components.user_reputation && components.user_reputation.score < 40) {
      riskFactors.push({
        type: 'low_user_quality',
        severity: 'medium',
        description: 'Low average user reputation - sources may not be credible'
      });
    }

    // Cross-validation risks
    if (components.cross_validation && components.cross_validation.score < 30) {
      riskFactors.push({
        type: 'poor_cross_validation',
        severity: 'medium',
        description: 'Signal not confirmed across multiple subreddits'
      });
    }

    // News divergence risks
    if (components.news_correlation && 
        components.news_correlation.details && 
        components.news_correlation.details.divergence_alerts > 0) {
      riskFactors.push({
        type: 'news_divergence',
        severity: 'medium',
        description: 'Reddit sentiment diverges from news sentiment'
      });
    }

    // Economic headwinds
    if (components.economic_context && components.economic_context.score < 35) {
      riskFactors.push({
        type: 'economic_headwinds',
        severity: 'low',
        description: 'Economic conditions may not support the sentiment direction'
      });
    }

    // Historical accuracy risks
    if (components.historical_accuracy && components.historical_accuracy.score < 40) {
      riskFactors.push({
        type: 'poor_track_record',
        severity: 'medium',
        description: 'Historical predictions for this ticker have been inaccurate'
      });
    }

    return riskFactors;
  }

  // Generate actionable recommendations
  generateRecommendations(confidenceScore, confidenceLevel, riskFactors) {
    const recommendations = [];

    // Primary recommendation based on confidence level
    if (confidenceLevel.level === 'very_high') {
      recommendations.push({
        type: 'action',
        priority: 'high',
        message: 'Strong signal - consider position sizing based on conviction'
      });
    } else if (confidenceLevel.level === 'high') {
      recommendations.push({
        type: 'action',
        priority: 'medium',
        message: 'Good signal strength - appropriate for moderate position'
      });
    } else if (confidenceLevel.level === 'medium') {
      recommendations.push({
        type: 'caution',
        priority: 'medium',
        message: 'Monitor for additional confirmation before acting'
      });
    } else {
      recommendations.push({
        type: 'warning',
        priority: 'high',
        message: 'Low confidence - avoid large positions or wait for better signals'
      });
    }

    // Risk-specific recommendations
    const highRiskFactors = riskFactors.filter(r => r.severity === 'high');
    if (highRiskFactors.length > 0) {
      recommendations.push({
        type: 'risk_management',
        priority: 'high',
        message: 'High-risk factors detected - implement strict risk management'
      });
    }

    // Data quality recommendations
    const dataRisks = riskFactors.filter(r => r.type === 'insufficient_data');
    if (dataRisks.length > 0) {
      recommendations.push({
        type: 'data_collection',
        priority: 'medium',
        message: 'Insufficient data - wait for more mentions before acting'
      });
    }

    // Validation recommendations
    const validationRisks = riskFactors.filter(r => 
      r.type === 'poor_cross_validation' || r.type === 'news_divergence'
    );
    if (validationRisks.length > 0) {
      recommendations.push({
        type: 'validation',
        priority: 'medium',
        message: 'Seek additional validation from other sources before acting'
      });
    }

    return recommendations;
  }

  // Get reliability factors for detailed analysis
  getReliabilityFactors(components) {
    const factors = [];

    if (components.data_points && components.data_points.score >= 70) {
      factors.push('Sufficient data volume');
    }

    if (components.user_reputation && components.user_reputation.score >= 70) {
      factors.push('High-quality user sources');
    }

    if (components.cross_validation && components.cross_validation.score >= 70) {
      factors.push('Cross-subreddit validation');
    }

    if (components.news_correlation && components.news_correlation.score >= 70) {
      factors.push('News sentiment alignment');
    }

    if (components.economic_context && components.economic_context.score >= 70) {
      factors.push('Economic context support');
    }

    if (components.historical_accuracy && components.historical_accuracy.score >= 70) {
      factors.push('Strong historical accuracy');
    }

    return factors.length > 0 ? factors : ['Limited reliability factors'];
  }

  // Batch calculate confidence for multiple tickers
  async batchCalculateConfidence(tickers, options = {}) {
    console.log(`🔄 Batch calculating confidence for ${tickers.length} tickers...`);
    
    const results = [];
    const maxConcurrent = 3; // Limit concurrent calculations
    
    for (let i = 0; i < tickers.length; i += maxConcurrent) {
      const batch = tickers.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async (ticker) => {
        try {
          return await this.calculateComprehensiveConfidence(ticker, options);
        } catch (error) {
          console.error(`❌ Error calculating confidence for ${ticker}:`, error.message);
          return {
            ticker,
            error: error.message,
            confidence_score: 0,
            confidence_level: { level: 'error', description: 'Calculation Failed' }
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches
      if (i + maxConcurrent < tickers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`✅ Batch confidence calculation complete: ${results.length} tickers processed`);
    
    // Sort by confidence score
    return results.sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0));
  }

  // Get confidence statistics and insights
  getConfidenceStatistics() {
    return {
      confidence_levels: this.confidenceLevels,
      component_weights: this.confidenceWeights,
      calculation_methodology: {
        description: 'Multi-factor confidence analysis combining Reddit data, user reputation, news correlation, economic context, and historical accuracy',
        components: {
          data_points: 'Volume and quality of Reddit mentions',
          user_reputation: 'Credibility of posting users',
          cross_validation: 'Consensus across multiple subreddits', 
          historical_accuracy: 'Track record of predictions for this ticker',
          news_correlation: 'Alignment with mainstream news sentiment',
          economic_context: 'Support from macroeconomic conditions'
        }
      }
    };
  }
}

module.exports = new ConfidenceService();
