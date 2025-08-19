const UserProfile = require('../models/UserProfile');
const RedditPost = require('../models/RedditPost');
const StockData = require('../models/StockData');
const claudeService = require('./claudeService');
const fredService = require('./fredService');
const alphaVantageService = require('./alphaVantageService');

class UserReputationService {
  constructor() {
    this.predictionAccuracyCache = new Map();
    this.reputationTiers = {
      'legend': { min: 90, color: '#FFD700', badge: '🏆' },
      'expert': { min: 80, color: '#C0C0C0', badge: '⭐' },
      'advanced': { min: 65, color: '#CD7F32', badge: '🎯' },
      'intermediate': { min: 45, color: '#4CAF50', badge: '📈' },
      'novice': { min: 0, color: '#9E9E9E', badge: '📚' }
    };
  }

  // Enhanced user reputation calculation with Phase 3 features
  async calculateEnhancedReputation(username) {
    try {
      const userProfile = await UserProfile.findOne({ username });
      if (!userProfile) {
        console.log(`❌ User profile not found for ${username}`);
        return null;
      }

      console.log(`🔄 Calculating enhanced reputation for ${username}...`);

      // Get user's historical posts
      const userPosts = await RedditPost.find({ 
        author: username,
        processed: true,
        'tickers.0': { $exists: true }
      }).sort({ created_utc: -1 }).limit(50);

      // Calculate prediction accuracy
      const predictionAccuracy = await this.calculatePredictionAccuracy(userProfile, userPosts);
      
      // Analyze posting patterns for manipulation detection
      const behaviorAnalysis = await this.analyzeUserBehavior(userPosts);
      
      // Claude-based content quality assessment
      const contentQuality = await this.assessContentQuality(userPosts);
      
      // Calculate market timing ability
      const marketTiming = await this.calculateMarketTiming(userPosts);
      
      // Calculate sector expertise
      const sectorExpertise = await this.calculateSectorExpertise(userPosts);
      
      // Calculate enhanced reputation score
      const enhancedScore = this.calculateFinalReputationScore({
        baseQualityScore: userProfile.quality_score,
        predictionAccuracy: predictionAccuracy.accuracy_rate,
        contentQuality: contentQuality.avg_quality,
        marketTiming: marketTiming.timing_score,
        behaviorScore: behaviorAnalysis.trust_score,
        sectorExpertise: sectorExpertise.max_expertise
      });

      // Update user profile
      userProfile.accuracy_score = predictionAccuracy.accuracy_rate;
      userProfile.predictions_made = predictionAccuracy.total_predictions;
      userProfile.correct_predictions = predictionAccuracy.correct_predictions;
      userProfile.quality_score = enhancedScore;
      
      // Check for suspicious behavior
      if (behaviorAnalysis.trust_score < 30) {
        userProfile.is_suspicious = true;
      }
      
      await userProfile.save();

      const result = {
        username,
        enhanced_reputation: {
          overall_score: enhancedScore,
          tier: userProfile.reputation_tier,
          tier_info: this.reputationTiers[userProfile.reputation_tier],
          components: {
            base_quality: userProfile.quality_score,
            prediction_accuracy: predictionAccuracy.accuracy_rate,
            content_quality: contentQuality.avg_quality,
            market_timing: marketTiming.timing_score,
            behavior_score: behaviorAnalysis.trust_score,
            sector_expertise: sectorExpertise.max_expertise
          },
          detailed_analysis: {
            prediction_accuracy: predictionAccuracy,
            behavior_analysis: behaviorAnalysis,
            content_quality: contentQuality,
            market_timing: marketTiming,
            sector_expertise: sectorExpertise
          },
          strengths: this.identifyUserStrengths(predictionAccuracy, contentQuality, marketTiming, sectorExpertise),
          areas_for_improvement: this.identifyImprovementAreas(predictionAccuracy, contentQuality, behaviorAnalysis),
          reputation_badges: this.calculateReputationBadges(predictionAccuracy, contentQuality, marketTiming, sectorExpertise)
        },
        last_updated: new Date().toISOString()
      };

      console.log(`✅ Enhanced reputation calculated for ${username}: ${enhancedScore.toFixed(1)}/100`);
      return result;

    } catch (error) {
      console.error(`❌ Error calculating enhanced reputation for ${username}:`, error.message);
      throw error;
    }
  }

  // Calculate prediction accuracy by comparing sentiment to actual price movements
  async calculatePredictionAccuracy(userProfile, userPosts) {
    if (userPosts.length === 0) {
      return {
        accuracy_rate: 0,
        total_predictions: 0,
        correct_predictions: 0,
        predictions_by_timeframe: {},
        recent_performance: 'insufficient_data'
      };
    }

    const cacheKey = `${userProfile.username}_accuracy`;
    
    // Check cache for recent calculation
    if (this.predictionAccuracyCache.has(cacheKey)) {
      const cached = this.predictionAccuracyCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 60 * 60 * 1000) { // 1 hour cache
        return cached.data;
      }
    }

    let totalPredictions = 0;
    let correctPredictions = 0;
    const timeframes = { '1d': 0, '3d': 0, '7d': 0 };
    const timeframeCorrect = { '1d': 0, '3d': 0, '7d': 0 };

    for (const post of userPosts) {
      if (!post.tickers || post.tickers.length === 0) continue;

      for (const ticker of post.tickers) {
        try {
          // Get price data for the days following the post
          const postDate = new Date(post.created_utc);
          const predictions = await this.evaluatePrediction(
            ticker.symbol,
            post.sentiment_score,
            postDate
          );

          if (predictions) {
            totalPredictions++;
            
            // Check accuracy for different timeframes
            ['1d', '3d', '7d'].forEach(timeframe => {
              if (predictions[timeframe] && predictions[timeframe].has_data) {
                timeframes[timeframe]++;
                if (predictions[timeframe].is_correct) {
                  timeframeCorrect[timeframe]++;
                  if (timeframe === '3d') { // Use 3-day as primary accuracy metric
                    correctPredictions++;
                  }
                }
              }
            });
          }
        } catch (error) {
          console.error(`⚠️ Error evaluating prediction for ${ticker.symbol}:`, error.message);
        }
      }
    }

    const accuracyRate = totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0;
    
    // Calculate recent performance trend (last 10 predictions)
    const recentPosts = userPosts.slice(0, 10);
    let recentCorrect = 0;
    let recentTotal = 0;
    
    for (const post of recentPosts) {
      if (post.tickers) {
        for (const ticker of post.tickers) {
          const predictions = await this.evaluatePrediction(
            ticker.symbol,
            post.sentiment_score,
            new Date(post.created_utc)
          );
          if (predictions && predictions['3d'] && predictions['3d'].has_data) {
            recentTotal++;
            if (predictions['3d'].is_correct) recentCorrect++;
          }
        }
      }
    }

    let recentPerformance = 'stable';
    if (recentTotal >= 5) {
      const recentAccuracy = (recentCorrect / recentTotal) * 100;
      if (recentAccuracy > accuracyRate + 10) {
        recentPerformance = 'improving';
      } else if (recentAccuracy < accuracyRate - 10) {
        recentPerformance = 'declining';
      }
    }

    const result = {
      accuracy_rate: Math.round(accuracyRate * 100) / 100,
      total_predictions: totalPredictions,
      correct_predictions: correctPredictions,
      predictions_by_timeframe: {
        '1d': timeframes['1d'] > 0 ? Math.round((timeframeCorrect['1d'] / timeframes['1d']) * 100) : 0,
        '3d': timeframes['3d'] > 0 ? Math.round((timeframeCorrect['3d'] / timeframes['3d']) * 100) : 0,
        '7d': timeframes['7d'] > 0 ? Math.round((timeframeCorrect['7d'] / timeframes['7d']) * 100) : 0
      },
      recent_performance: recentPerformance,
      confidence: Math.min(100, totalPredictions * 2) // Higher confidence with more predictions
    };

    // Cache the result
    this.predictionAccuracyCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  }

  // Evaluate a single prediction against actual price movement
  async evaluatePrediction(ticker, sentimentScore, postDate) {
    try {
      // Get price data for the ticker around the post date
      const startDate = new Date(postDate);
      const endDate = new Date(postDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days after

      // Try to get historical price data (would need implementation in alphaVantageService)
      // For now, simulate based on current data patterns
      const stockData = await StockData.findOne({ ticker: ticker.toUpperCase() });
      if (!stockData || !stockData.price_data || stockData.price_data.length === 0) {
        return null;
      }

      // Find the closest price data to our dates
      const basePrice = stockData.price_data.find(p => 
        new Date(p.timestamp) <= startDate
      );
      
      if (!basePrice) return null;

      // Simulate price movements for evaluation
      // In a real implementation, this would use actual historical data
      const results = {};
      
      ['1d', '3d', '7d'].forEach(timeframe => {
        const days = parseInt(timeframe);
        const futureDate = new Date(postDate.getTime() + days * 24 * 60 * 60 * 1000);
        
        // Find price data closest to future date
        const futurePrice = stockData.price_data.find(p => 
          new Date(p.timestamp) >= futureDate
        );
        
        if (futurePrice && basePrice) {
          const priceChange = ((futurePrice.close - basePrice.close) / basePrice.close) * 100;
          const sentimentDirection = sentimentScore > 10 ? 'positive' : sentimentScore < -10 ? 'negative' : 'neutral';
          const priceDirection = priceChange > 2 ? 'positive' : priceChange < -2 ? 'negative' : 'neutral';
          
          results[timeframe] = {
            has_data: true,
            price_change: priceChange,
            sentiment_direction: sentimentDirection,
            price_direction: priceDirection,
            is_correct: (sentimentDirection === priceDirection) || 
                       (sentimentDirection === 'neutral' && Math.abs(priceChange) <= 2)
          };
        } else {
          results[timeframe] = { has_data: false };
        }
      });

      return results;

    } catch (error) {
      console.error(`❌ Error evaluating prediction for ${ticker}:`, error.message);
      return null;
    }
  }

  // Analyze user behavior patterns for manipulation detection
  async analyzeUserBehavior(userPosts) {
    if (userPosts.length === 0) {
      return {
        trust_score: 50,
        behavior_flags: [],
        posting_patterns: {},
        manipulation_risk: 'low'
      };
    }

    const behaviorFlags = [];
    let trustScore = 100;

    // Analyze posting frequency
    const postDates = userPosts.map(p => new Date(p.created_utc));
    const timeSpans = [];
    for (let i = 1; i < postDates.length; i++) {
      timeSpans.push((postDates[i-1] - postDates[i]) / (1000 * 60 * 60)); // Hours between posts
    }

    const avgTimeBetweenPosts = timeSpans.length > 0 ? 
      timeSpans.reduce((sum, span) => sum + span, 0) / timeSpans.length : 24;

    // Flag suspicious posting frequency
    if (avgTimeBetweenPosts < 2) {
      behaviorFlags.push('extremely_high_posting_frequency');
      trustScore -= 20;
    } else if (avgTimeBetweenPosts < 6) {
      behaviorFlags.push('high_posting_frequency');
      trustScore -= 10;
    }

    // Analyze content diversity
    const uniqueTickers = new Set();
    const subreddits = new Set();
    let totalContentLength = 0;
    let duplicateContentCount = 0;
    const contentHashes = new Set();

    for (const post of userPosts) {
      if (post.tickers) {
        post.tickers.forEach(ticker => uniqueTickers.add(ticker.symbol));
      }
      subreddits.add(post.subreddit);
      totalContentLength += (post.title + post.content).length;
      
      // Simple duplicate detection
      const contentHash = this.simpleHash(post.title + post.content);
      if (contentHashes.has(contentHash)) {
        duplicateContentCount++;
      } else {
        contentHashes.add(contentHash);
      }
    }

    // Flag if too focused on single ticker (possible pump)
    if (uniqueTickers.size === 1 && userPosts.length > 10) {
      behaviorFlags.push('single_ticker_focus');
      trustScore -= 15;
    }

    // Flag duplicate content
    const duplicateRatio = duplicateContentCount / userPosts.length;
    if (duplicateRatio > 0.3) {
      behaviorFlags.push('excessive_duplicate_content');
      trustScore -= 25;
    }

    // Flag if only active in one subreddit
    if (subreddits.size === 1 && userPosts.length > 20) {
      behaviorFlags.push('single_subreddit_activity');
      trustScore -= 10;
    }

    // Analyze sentiment consistency (too consistently positive/negative might be suspicious)
    const sentiments = userPosts.map(p => p.sentiment_score);
    const avgSentiment = sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length;
    const sentimentVariance = sentiments.reduce((sum, s) => sum + Math.pow(s - avgSentiment, 2), 0) / sentiments.length;
    
    if (sentimentVariance < 100 && Math.abs(avgSentiment) > 30) {
      behaviorFlags.push('suspicious_sentiment_consistency');
      trustScore -= 15;
    }

    // Economic context awareness (check if user adjusts to market conditions)
    const economicAwareness = await this.assessEconomicAwareness(userPosts);
    if (economicAwareness.score < 30) {
      behaviorFlags.push('lacks_economic_context_awareness');
      trustScore -= 10;
    }

    let manipulationRisk = 'low';
    if (trustScore < 40) {
      manipulationRisk = 'high';
    } else if (trustScore < 60) {
      manipulationRisk = 'medium';
    }

    return {
      trust_score: Math.max(0, trustScore),
      behavior_flags: behaviorFlags,
      posting_patterns: {
        avg_time_between_posts_hours: Math.round(avgTimeBetweenPosts * 100) / 100,
        unique_tickers: uniqueTickers.size,
        unique_subreddits: subreddits.size,
        duplicate_content_ratio: Math.round(duplicateRatio * 100),
        avg_content_length: Math.round(totalContentLength / userPosts.length),
        sentiment_variance: Math.round(sentimentVariance)
      },
      manipulation_risk: manipulationRisk,
      economic_awareness: economicAwareness
    };
  }

  // Assess user's economic context awareness
  async assessEconomicAwareness(userPosts) {
    try {
      // Get current economic indicators for context
      const economicData = await fredService.getCurrentIndicators();
      
      if (!economicData.indicators || Object.keys(economicData.indicators).length === 0) {
        return { score: 50, analysis: 'unable_to_assess_no_economic_data' };
      }

      let awarenessScore = 0;
      let totalChecks = 0;

      // Check if user mentions economic factors in posts
      const economicKeywords = [
        'fed', 'federal reserve', 'interest rate', 'inflation', 'cpi', 'unemployment',
        'gdp', 'recession', 'bull market', 'bear market', 'economic', 'monetary policy',
        'fiscal policy', 'yield curve', 'treasury', 'bond', 'vix', 'volatility'
      ];

      let economicMentions = 0;
      for (const post of userPosts) {
        const content = (post.title + ' ' + post.content).toLowerCase();
        for (const keyword of economicKeywords) {
          if (content.includes(keyword)) {
            economicMentions++;
            break; // Count once per post
          }
        }
      }

      const economicMentionRatio = economicMentions / userPosts.length;
      awarenessScore += economicMentionRatio * 100;
      totalChecks++;

      // Check if sentiment aligns with economic conditions
      // During high inflation periods, defensive sentiment should be higher
      if (economicData.market_context && economicData.market_context.inflation_trend === 'rising') {
        const avgSentiment = userPosts.reduce((sum, p) => sum + p.sentiment_score, 0) / userPosts.length;
        if (avgSentiment < 20) { // More cautious during inflation
          awarenessScore += 30;
        }
        totalChecks++;
      }

      // Check if user adjusts to interest rate environment
      if (economicData.market_context && economicData.market_context.interest_rate_environment === 'restrictive') {
        const recentSentiment = userPosts.slice(0, 10).reduce((sum, p) => sum + p.sentiment_score, 0) / 10;
        if (recentSentiment < 30) { // More cautious during tight monetary policy
          awarenessScore += 25;
        }
        totalChecks++;
      }

      const finalScore = totalChecks > 0 ? awarenessScore / totalChecks : 50;

      return {
        score: Math.min(100, finalScore),
        economic_mentions_ratio: Math.round(economicMentionRatio * 100),
        analysis: finalScore > 70 ? 'high_economic_awareness' : 
                 finalScore > 40 ? 'moderate_economic_awareness' : 'low_economic_awareness'
      };

    } catch (error) {
      console.error('❌ Error assessing economic awareness:', error.message);
      return { score: 50, analysis: 'assessment_failed', error: error.message };
    }
  }

  // Assess content quality using Claude
  async assessContentQuality(userPosts) {
    if (userPosts.length === 0) {
      return {
        avg_quality: 0,
        quality_distribution: { high: 0, medium: 0, low: 0 },
        content_types: {},
        educational_value: 0
      };
    }

    try {
      // Sample recent posts for Claude analysis (limit to avoid API costs)
      const samplePosts = userPosts.slice(0, Math.min(10, userPosts.length));
      const qualityScores = [];
      const contentTypes = {};
      let totalEducationalValue = 0;

      for (const post of samplePosts) {
        try {
          const claudeAssessment = await claudeService.assessPostQuality(post);
          
          qualityScores.push(claudeAssessment.quality_score);
          
          // Track content types
          const contentType = claudeAssessment.content_type || 'discussion';
          contentTypes[contentType] = (contentTypes[contentType] || 0) + 1;
          
          totalEducationalValue += claudeAssessment.educational_value || 0;
          
        } catch (error) {
          console.error(`⚠️ Claude assessment failed for post ${post.reddit_id}:`, error.message);
          // Fall back to basic quality score
          qualityScores.push(post.quality_score || 50);
        }
      }

      const avgQuality = qualityScores.length > 0 ? 
        qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length : 0;

      const qualityDistribution = {
        high: qualityScores.filter(score => score >= 70).length,
        medium: qualityScores.filter(score => score >= 40 && score < 70).length,
        low: qualityScores.filter(score => score < 40).length
      };

      return {
        avg_quality: Math.round(avgQuality * 100) / 100,
        quality_distribution: {
          high: Math.round((qualityDistribution.high / qualityScores.length) * 100),
          medium: Math.round((qualityDistribution.medium / qualityScores.length) * 100),
          low: Math.round((qualityDistribution.low / qualityScores.length) * 100)
        },
        content_types: contentTypes,
        educational_value: totalEducationalValue / samplePosts.length,
        sample_size: samplePosts.length
      };

    } catch (error) {
      console.error('❌ Error assessing content quality:', error.message);
      
      // Fallback to basic quality analysis
      const basicQualityScores = userPosts.map(post => post.quality_score || 50);
      const avgBasicQuality = basicQualityScores.reduce((sum, score) => sum + score, 0) / basicQualityScores.length;
      
      return {
        avg_quality: avgBasicQuality,
        quality_distribution: { high: 30, medium: 50, low: 20 }, // Default distribution
        content_types: { discussion: userPosts.length },
        educational_value: 50,
        fallback: true,
        error: error.message
      };
    }
  }

  // Calculate market timing ability
  async calculateMarketTiming(userPosts) {
    if (userPosts.length < 5) {
      return {
        timing_score: 50,
        analysis: 'insufficient_data',
        market_cycle_awareness: 'unknown'
      };
    }

    try {
      // Analyze if user's sentiment timing aligns with market cycles
      let timingScore = 50;
      let bullishInDownMarket = 0;
      let bearishInUpMarket = 0;
      let totalTimingChecks = 0;

      for (const post of userPosts) {
        // Get market context around post date
        const postDate = new Date(post.created_utc);
        
        // Simulate market context analysis (in real implementation, use historical VIX/SPY data)
        const marketSentiment = await this.getMarketSentimentAtDate(postDate);
        
        if (marketSentiment) {
          totalTimingChecks++;
          
          // Check if user sentiment aligns with market conditions
          if (marketSentiment === 'bearish' && post.sentiment_score < -20) {
            timingScore += 5; // Good timing - bearish in down market
          } else if (marketSentiment === 'bullish' && post.sentiment_score > 20) {
            timingScore += 5; // Good timing - bullish in up market
          } else if (marketSentiment === 'bearish' && post.sentiment_score > 30) {
            bullishInDownMarket++;
            timingScore -= 3; // Poor timing - overly bullish in down market
          } else if (marketSentiment === 'bullish' && post.sentiment_score < -30) {
            bearishInUpMarket++;
            timingScore -= 3; // Poor timing - overly bearish in up market
          }
        }
      }

      // Analyze contrarian indicators (sometimes good to be contrarian)
      let marketCycleAwareness = 'moderate';
      if (bullishInDownMarket / totalTimingChecks > 0.3) {
        marketCycleAwareness = 'contrarian_bullish';
        timingScore += 10; // Reward contrarian thinking if consistent
      } else if (bearishInUpMarket / totalTimingChecks > 0.3) {
        marketCycleAwareness = 'contrarian_bearish';
        timingScore += 5;
      } else if ((bullishInDownMarket + bearishInUpMarket) / totalTimingChecks < 0.1) {
        marketCycleAwareness = 'trend_following';
      }

      return {
        timing_score: Math.max(0, Math.min(100, timingScore)),
        analysis: totalTimingChecks > 5 ? 'sufficient_data' : 'limited_data',
        market_cycle_awareness: marketCycleAwareness,
        contrarian_signals: {
          bullish_in_down_market: bullishInDownMarket,
          bearish_in_up_market: bearishInUpMarket,
          total_timing_checks: totalTimingChecks
        }
      };

    } catch (error) {
      console.error('❌ Error calculating market timing:', error.message);
      return {
        timing_score: 50,
        analysis: 'calculation_failed',
        error: error.message
      };
    }
  }

  // Calculate sector expertise
  async calculateSectorExpertise(userPosts) {
    const sectorMentions = {};
    const sectorSentiments = {};
    
    // Map common tickers to sectors
    const tickerToSector = {
      'AAPL': 'Technology', 'MSFT': 'Technology', 'GOOGL': 'Technology', 'META': 'Technology',
      'TSLA': 'Automotive', 'F': 'Automotive', 'GM': 'Automotive',
      'JPM': 'Financial', 'BAC': 'Financial', 'WFC': 'Financial', 'GS': 'Financial',
      'JNJ': 'Healthcare', 'PFE': 'Healthcare', 'UNH': 'Healthcare', 'MRNA': 'Healthcare',
      'XOM': 'Energy', 'CVX': 'Energy', 'COP': 'Energy',
      'AMZN': 'E-commerce', 'NFLX': 'Media', 'DIS': 'Media',
      'WMT': 'Retail', 'HD': 'Retail', 'TGT': 'Retail'
    };

    for (const post of userPosts) {
      if (post.tickers) {
        for (const ticker of post.tickers) {
          const sector = tickerToSector[ticker.symbol] || 'Other';
          
          if (!sectorMentions[sector]) {
            sectorMentions[sector] = 0;
            sectorSentiments[sector] = [];
          }
          
          sectorMentions[sector]++;
          sectorSentiments[sector].push(post.sentiment_score);
        }
      }
    }

    // Calculate expertise scores for each sector
    const sectorExpertise = {};
    let maxExpertise = 0;
    let topSector = 'None';

    for (const [sector, mentions] of Object.entries(sectorMentions)) {
      if (mentions >= 3) { // Need at least 3 mentions to claim expertise
        const avgSentiment = sectorSentiments[sector].reduce((sum, s) => sum + s, 0) / sectorSentiments[sector].length;
        const sentimentConsistency = this.calculateConsistency(sectorSentiments[sector]);
        
        // Expertise score based on mentions frequency and sentiment consistency
        const expertiseScore = Math.min(100, (mentions * 10) + sentimentConsistency * 20);
        
        sectorExpertise[sector] = {
          mentions: mentions,
          avg_sentiment: Math.round(avgSentiment * 100) / 100,
          sentiment_consistency: sentimentConsistency,
          expertise_score: expertiseScore
        };

        if (expertiseScore > maxExpertise) {
          maxExpertise = expertiseScore;
          topSector = sector;
        }
      }
    }

    return {
      sector_expertise: sectorExpertise,
      max_expertise: maxExpertise,
      top_sector: topSector,
      sectors_covered: Object.keys(sectorExpertise).length,
      specialization_level: maxExpertise > 70 ? 'high' : maxExpertise > 40 ? 'medium' : 'low'
    };
  }

  // Calculate final reputation score using weighted components
  calculateFinalReputationScore(components) {
    const weights = {
      baseQualityScore: 0.25,
      predictionAccuracy: 0.25,
      contentQuality: 0.20,
      marketTiming: 0.10,
      behaviorScore: 0.15,
      sectorExpertise: 0.05
    };

    let weightedScore = 0;
    let totalWeight = 0;

    for (const [component, weight] of Object.entries(weights)) {
      if (typeof components[component] === 'number' && !isNaN(components[component])) {
        weightedScore += components[component] * weight;
        totalWeight += weight;
      }
    }

    // Normalize if some components are missing
    const finalScore = totalWeight > 0 ? (weightedScore / totalWeight) : 50;
    
    return Math.max(0, Math.min(100, finalScore));
  }

  // Identify user strengths
  identifyUserStrengths(predictionAccuracy, contentQuality, marketTiming, sectorExpertise) {
    const strengths = [];

    if (predictionAccuracy.accuracy_rate > 70) {
      strengths.push('Excellent prediction accuracy');
    }
    
    if (contentQuality.avg_quality > 80) {
      strengths.push('High-quality content creation');
    }
    
    if (contentQuality.educational_value > 70) {
      strengths.push('Strong educational value in posts');
    }
    
    if (marketTiming.timing_score > 75) {
      strengths.push('Good market timing abilities');
    }
    
    if (marketTiming.market_cycle_awareness === 'contrarian_bullish') {
      strengths.push('Contrarian investment mindset');
    }
    
    if (sectorExpertise.max_expertise > 80) {
      strengths.push(`Deep expertise in ${sectorExpertise.top_sector} sector`);
    }
    
    if (sectorExpertise.sectors_covered > 5) {
      strengths.push('Broad market knowledge across sectors');
    }

    return strengths.length > 0 ? strengths : ['Developing investment analysis skills'];
  }

  // Identify areas for improvement
  identifyImprovementAreas(predictionAccuracy, contentQuality, behaviorAnalysis) {
    const areas = [];

    if (predictionAccuracy.accuracy_rate < 40) {
      areas.push('Focus on improving prediction accuracy');
    }
    
    if (contentQuality.avg_quality < 50) {
      areas.push('Enhance content quality and analysis depth');
    }
    
    if (predictionAccuracy.total_predictions < 10) {
      areas.push('Build track record with more predictions');
    }
    
    if (behaviorAnalysis.trust_score < 60) {
      areas.push('Improve posting patterns and reduce suspicious behavior');
    }
    
    if (behaviorAnalysis.economic_awareness && behaviorAnalysis.economic_awareness.score < 40) {
      areas.push('Develop greater awareness of economic context');
    }

    return areas.length > 0 ? areas : ['Continue developing investment expertise'];
  }

  // Calculate reputation badges
  calculateReputationBadges(predictionAccuracy, contentQuality, marketTiming, sectorExpertise) {
    const badges = [];

    // Accuracy badges
    if (predictionAccuracy.accuracy_rate > 80) {
      badges.push({ name: 'Oracle', icon: '🔮', description: 'Exceptional prediction accuracy' });
    } else if (predictionAccuracy.accuracy_rate > 65) {
      badges.push({ name: 'Analyst', icon: '📊', description: 'Strong prediction skills' });
    }

    // Content quality badges
    if (contentQuality.avg_quality > 85) {
      badges.push({ name: 'Educator', icon: '🎓', description: 'Creates highly educational content' });
    }
    
    if (contentQuality.content_types && contentQuality.content_types['DD'] > 5) {
      badges.push({ name: 'DD Master', icon: '📝', description: 'Expert in due diligence posts' });
    }

    // Market timing badges
    if (marketTiming.market_cycle_awareness === 'contrarian_bullish') {
      badges.push({ name: 'Contrarian', icon: '🔄', description: 'Independent contrarian thinker' });
    }

    // Sector expertise badges
    if (sectorExpertise.max_expertise > 80) {
      badges.push({ 
        name: `${sectorExpertise.top_sector} Expert`, 
        icon: '🏅', 
        description: `Deep expertise in ${sectorExpertise.top_sector}` 
      });
    }

    // Experience badges
    if (predictionAccuracy.total_predictions > 50) {
      badges.push({ name: 'Veteran', icon: '⭐', description: 'Extensive track record' });
    }

    return badges;
  }

  // Utility functions
  async getMarketSentimentAtDate(date) {
    // Simplified market sentiment based on VIX-like logic
    // In real implementation, this would use historical market data
    const dayOfWeek = date.getDay();
    const hour = date.getHours();
    
    // Simulate market sentiment (replace with actual market data)
    if (hour < 9 || hour > 16) return null; // Outside market hours
    
    // Simple simulation - in reality, use VIX, SPY movement, etc.
    const random = Math.random();
    if (random > 0.6) return 'bullish';
    if (random < 0.4) return 'bearish';
    return 'neutral';
  }

  calculateConsistency(values) {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Convert to consistency score (0-1, where 1 is most consistent)
    return Math.max(0, 1 - (stdDev / 100));
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  // Get top users by reputation
  async getTopUsers(options = {}) {
    const {
      limit = 50,
      minPosts = 5,
      tier = null,
      sortBy = 'quality_score'
    } = options;

    try {
      let query = {
        is_bot: false,
        is_suspicious: false,
        post_count: { $gte: minPosts }
      };

      if (tier) {
        query.reputation_tier = tier;
      }

      const users = await UserProfile.find(query)
        .sort({ [sortBy]: -1, accuracy_score: -1 })
        .limit(limit);

      return users.map(user => ({
        username: user.username,
        reputation_tier: user.reputation_tier,
        quality_score: user.quality_score,
        accuracy_score: user.accuracy_score,
        post_count: user.post_count,
        tier_info: this.reputationTiers[user.reputation_tier]
      }));

    } catch (error) {
      console.error('❌ Error getting top users:', error.message);
      throw error;
    }
  }
}

module.exports = new UserReputationService();
