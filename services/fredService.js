const axios = require('axios');
require('dotenv').config();

class FredService {
  constructor() {
    this.apiKey = process.env.FRED_API_KEY || '';
    this.baseUrl = 'https://api.stlouisfed.org/fred';
    this.isConfigured = !!this.apiKey;
    
    // Rate limiting - FRED is generous but we'll be respectful
    this.lastRequest = 0;
    this.minInterval = 500; // 0.5 seconds between requests
    
    // Usage tracking
    this.usage = {
      requests_today: 0,
      last_reset: new Date().toISOString().split('T')[0]
    };
    
    // Cache for economic data
    this.cache = new Map();
    this.cacheTimeout = 60 * 60 * 1000; // 1 hour for economic data
    
    // Key economic indicators
    this.indicators = {
      // Interest Rates
      fed_funds_rate: 'FEDFUNDS',
      ten_year_treasury: 'GS10',
      three_month_treasury: 'GS3M',
      corporate_bond_yield: 'BAMLC0A0CM',
      
      // Economic Growth
      gdp: 'GDP',
      gdp_growth: 'A191RL1Q225SBEA',
      unemployment_rate: 'UNRATE',
      employment_population_ratio: 'EMRATIO',
      
      // Inflation
      cpi: 'CPIAUCSL',
      core_cpi: 'CPILFESL',
      pce: 'PCEPI',
      core_pce: 'PCEPILFE',
      
      // Market Indicators
      vix: 'VIXCLS',
      sp500: 'SP500',
      dollar_index: 'DTWEXBGS',
      
      // Consumer & Business
      consumer_sentiment: 'UMCSENT',
      consumer_confidence: 'CSCICP03USM665S',
      retail_sales: 'RSAFS',
      business_applications: 'BABATOTALSAUS',
      
      // Housing
      housing_starts: 'HOUST',
      building_permits: 'PERMIT',
      home_prices: 'CSUSHPISA',
      mortgage_rate: 'MORTGAGE30US',
      
      // Manufacturing
      industrial_production: 'INDPRO',
      capacity_utilization: 'TCU',
      pmi: 'MANEMP',
      
      // Money Supply
      m1_money_supply: 'M1SL',
      m2_money_supply: 'M2SL'
    };
    
    if (!this.isConfigured) {
      console.log('⚠️  FRED API not configured - economic data features disabled');
    } else {
      console.log('✅ FRED API configured successfully');
    }
  }

  // Get current economic indicators
  async getCurrentIndicators(indicatorKeys = null) {
    if (!this.isConfigured) {
      console.log('FRED API not available, returning empty economic data');
      return { indicators: {}, timestamp: new Date().toISOString() };
    }

    const keys = indicatorKeys || Object.keys(this.indicators);
    const cacheKey = `current_indicators_${keys.join('_')}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('📊 Using cached economic indicators');
        return cached.data;
      }
    }

    try {
      const results = {};
      
      // Fetch indicators in small batches to respect rate limits
      const chunks = this.chunkArray(keys, 5);
      
      for (const chunk of chunks) {
        const promises = chunk.map(async (key) => {
          const seriesId = this.indicators[key];
          if (!seriesId) return null;
          
          try {
            await this.enforceRateLimit();
            const data = await this.getSeriesLatest(seriesId);
            return { key, data };
          } catch (error) {
            console.error(`❌ Failed to fetch ${key} (${seriesId}):`, error.message);
            return { key, data: null };
          }
        });
        
        const chunkResults = await Promise.all(promises);
        chunkResults.forEach(result => {
          if (result && result.data) {
            results[result.key] = result.data;
          }
        });
        
        // Small delay between chunks
        if (chunks.indexOf(chunk) < chunks.length - 1) {
          await this.delay(1000);
        }
      }
      
      const response = {
        indicators: results,
        timestamp: new Date().toISOString(),
        market_context: this.analyzeMarketContext(results),
        economic_summary: this.generateEconomicSummary(results)
      };
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: response,
        timestamp: Date.now()
      });
      
      console.log(`📊 Fetched ${Object.keys(results).length} economic indicators`);
      
      return response;
      
    } catch (error) {
      console.error('❌ FRED API error:', error.message);
      return { indicators: {}, error: error.message, timestamp: new Date().toISOString() };
    }
  }

  // Get historical data for a specific indicator
  async getIndicatorHistory(indicatorKey, options = {}) {
    if (!this.isConfigured) {
      return { series_id: indicatorKey, data: [], error: 'FRED API not configured' };
    }

    const {
      startDate = this.getDateString(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)), // 1 year ago
      endDate = this.getDateString(new Date()),
      frequency = 'monthly'
    } = options;

    const seriesId = this.indicators[indicatorKey];
    if (!seriesId) {
      return { series_id: indicatorKey, data: [], error: 'Unknown indicator' };
    }

    const cacheKey = `history_${indicatorKey}_${startDate}_${endDate}_${frequency}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log(`📊 Using cached history for ${indicatorKey}`);
        return cached.data;
      }
    }

    try {
      await this.enforceRateLimit();
      
      const response = await axios.get(`${this.baseUrl}/series/observations`, {
        params: {
          series_id: seriesId,
          api_key: this.apiKey,
          file_type: 'json',
          observation_start: startDate,
          observation_end: endDate,
          frequency: frequency.charAt(0), // 'd', 'w', 'm', 'q', 'a'
          sort_order: 'desc'
        }
      });

      this.updateUsage();
      
      const processedData = this.processHistoricalData(response.data.observations);
      
      const result = {
        series_id: seriesId,
        indicator_key: indicatorKey,
        data: processedData,
        period: { start: startDate, end: endDate },
        frequency,
        timestamp: new Date().toISOString(),
        trend_analysis: this.analyzeTrend(processedData)
      };
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      console.log(`📊 Fetched ${processedData.length} data points for ${indicatorKey}`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ FRED API error for ${indicatorKey}:`, error.message);
      return { series_id: seriesId, data: [], error: error.message };
    }
  }

  // Get latest value for a specific series
  async getSeriesLatest(seriesId) {
    await this.enforceRateLimit();
    
    const response = await axios.get(`${this.baseUrl}/series/observations`, {
      params: {
        series_id: seriesId,
        api_key: this.apiKey,
        file_type: 'json',
        limit: 1,
        sort_order: 'desc'
      }
    });

    this.updateUsage();
    
    const observations = response.data.observations;
    if (observations && observations.length > 0) {
      const latest = observations[0];
      return {
        series_id: seriesId,
        value: parseFloat(latest.value),
        date: latest.date,
        realtime_start: latest.realtime_start,
        realtime_end: latest.realtime_end
      };
    }
    
    return null;
  }

  // Analyze market context based on economic indicators
  analyzeMarketContext(indicators) {
    const context = {
      interest_rate_environment: 'neutral',
      inflation_trend: 'stable',
      economic_growth: 'moderate',
      market_sentiment: 'neutral',
      risk_assessment: 'medium',
      sector_rotation_signals: []
    };
    
    try {
      // Interest Rate Environment
      if (indicators.fed_funds_rate && indicators.ten_year_treasury) {
        const fedRate = indicators.fed_funds_rate.value;
        const tenYear = indicators.ten_year_treasury.value;
        
        if (fedRate > 4.5) {
          context.interest_rate_environment = 'restrictive';
        } else if (fedRate < 1.5) {
          context.interest_rate_environment = 'accommodative';
        }
        
        // Yield curve analysis
        if (fedRate > tenYear) {
          context.yield_curve = 'inverted';
          context.risk_assessment = 'high';
        } else if (tenYear - fedRate > 2.5) {
          context.yield_curve = 'steep';
        } else {
          context.yield_curve = 'normal';
        }
      }
      
      // Inflation Analysis
      if (indicators.core_cpi || indicators.cpi) {
        const inflationRate = indicators.core_cpi?.value || indicators.cpi?.value;
        if (inflationRate > 3.5) {
          context.inflation_trend = 'rising';
          context.risk_assessment = 'high';
        } else if (inflationRate < 1.5) {
          context.inflation_trend = 'falling';
        }
      }
      
      // Economic Growth
      if (indicators.unemployment_rate) {
        const unemployment = indicators.unemployment_rate.value;
        if (unemployment < 4.0) {
          context.economic_growth = 'strong';
        } else if (unemployment > 6.0) {
          context.economic_growth = 'weak';
          context.risk_assessment = 'high';
        }
      }
      
      // Market Sentiment
      if (indicators.vix) {
        const vix = indicators.vix.value;
        if (vix > 30) {
          context.market_sentiment = 'fearful';
          context.risk_assessment = 'high';
        } else if (vix < 15) {
          context.market_sentiment = 'complacent';
        }
      }
      
      // Consumer Health
      if (indicators.consumer_sentiment || indicators.consumer_confidence) {
        const sentiment = indicators.consumer_sentiment?.value || indicators.consumer_confidence?.value;
        if (sentiment < 70) {
          context.consumer_health = 'weak';
        } else if (sentiment > 90) {
          context.consumer_health = 'strong';
        } else {
          context.consumer_health = 'moderate';
        }
      }
      
      // Sector Rotation Signals
      this.generateSectorRotationSignals(indicators, context);
      
    } catch (error) {
      console.error('❌ Error analyzing market context:', error.message);
    }
    
    return context;
  }

  // Generate sector rotation signals based on economic indicators
  generateSectorRotationSignals(indicators, context) {
    const signals = [];
    
    // Rising rates favor financials
    if (context.interest_rate_environment === 'restrictive') {
      signals.push({
        sector: 'Financials',
        signal: 'positive',
        reason: 'Rising interest rate environment benefits banks and financial institutions',
        strength: 'medium'
      });
    }
    
    // High inflation favors commodities and energy
    if (context.inflation_trend === 'rising') {
      signals.push({
        sector: 'Energy',
        signal: 'positive',
        reason: 'Rising inflation typically benefits commodity and energy sectors',
        strength: 'medium'
      });
      
      signals.push({
        sector: 'Materials',
        signal: 'positive',
        reason: 'Inflation hedge through commodity exposure',
        strength: 'medium'
      });
    }
    
    // Strong consumer sentiment favors discretionary
    if (indicators.consumer_sentiment?.value > 85) {
      signals.push({
        sector: 'Consumer Discretionary',
        signal: 'positive',
        reason: 'Strong consumer sentiment supports discretionary spending',
        strength: 'medium'
      });
    }
    
    // Weak sentiment favors defensive sectors
    if (context.market_sentiment === 'fearful' || context.economic_growth === 'weak') {
      signals.push({
        sector: 'Utilities',
        signal: 'positive',
        reason: 'Defensive positioning in uncertain economic environment',
        strength: 'medium'
      });
      
      signals.push({
        sector: 'Consumer Staples',
        signal: 'positive',
        reason: 'Defensive characteristics attractive during economic uncertainty',
        strength: 'medium'
      });
    }
    
    context.sector_rotation_signals = signals;
  }

  // Generate economic summary
  generateEconomicSummary(indicators) {
    const summary = {
      overall_assessment: 'neutral',
      key_concerns: [],
      positive_indicators: [],
      market_implications: [],
      confidence_level: 'medium'
    };
    
    try {
      let positiveCount = 0;
      let negativeCount = 0;
      
      // Assess each indicator
      Object.entries(indicators).forEach(([key, data]) => {
        if (!data || typeof data.value !== 'number') return;
        
        const assessment = this.assessIndicator(key, data.value);
        if (assessment.sentiment === 'positive') {
          positiveCount++;
          summary.positive_indicators.push(assessment.message);
        } else if (assessment.sentiment === 'negative') {
          negativeCount++;
          summary.key_concerns.push(assessment.message);
        }
      });
      
      // Overall assessment
      if (positiveCount > negativeCount * 1.5) {
        summary.overall_assessment = 'positive';
        summary.confidence_level = 'high';
      } else if (negativeCount > positiveCount * 1.5) {
        summary.overall_assessment = 'negative';
        summary.confidence_level = 'high';
      }
      
      // Generate market implications
      summary.market_implications = this.generateMarketImplications(summary);
      
    } catch (error) {
      console.error('❌ Error generating economic summary:', error.message);
    }
    
    return summary;
  }

  // Assess individual indicator
  assessIndicator(key, value) {
    const assessments = {
      fed_funds_rate: {
        positive: value < 3.0,
        message: value < 3.0 ? 'Low interest rates support growth' : 'High interest rates may constrain growth'
      },
      unemployment_rate: {
        positive: value < 5.0,
        message: value < 5.0 ? 'Low unemployment indicates strong labor market' : 'High unemployment suggests economic weakness'
      },
      cpi: {
        positive: value < 3.0,
        message: value < 3.0 ? 'Inflation under control' : 'Elevated inflation pressures'
      },
      vix: {
        positive: value < 20,
        message: value < 20 ? 'Low market volatility' : 'High market volatility indicates uncertainty'
      },
      consumer_sentiment: {
        positive: value > 80,
        message: value > 80 ? 'Strong consumer confidence' : 'Weak consumer sentiment'
      }
    };
    
    const assessment = assessments[key];
    if (!assessment) {
      return { sentiment: 'neutral', message: `${key}: ${value}` };
    }
    
    return {
      sentiment: assessment.positive ? 'positive' : 'negative',
      message: assessment.message
    };
  }

  // Generate market implications
  generateMarketImplications(summary) {
    const implications = [];
    
    if (summary.overall_assessment === 'positive') {
      implications.push('Economic conditions support risk-on sentiment');
      implications.push('Growth stocks may outperform defensive sectors');
    } else if (summary.overall_assessment === 'negative') {
      implications.push('Economic headwinds favor defensive positioning');
      implications.push('Quality and dividend stocks may be preferred');
    }
    
    if (summary.key_concerns.some(c => c.includes('inflation'))) {
      implications.push('Inflation concerns favor real assets and pricing power stocks');
    }
    
    if (summary.key_concerns.some(c => c.includes('interest'))) {
      implications.push('Rising rates headwind for growth and high-duration assets');
    }
    
    return implications;
  }

  // Process historical data
  processHistoricalData(observations) {
    return observations
      .filter(obs => obs.value !== '.')
      .map(obs => ({
        date: obs.date,
        value: parseFloat(obs.value),
        realtime_start: obs.realtime_start,
        realtime_end: obs.realtime_end
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  // Analyze trend in historical data
  analyzeTrend(data) {
    if (data.length < 2) {
      return { trend: 'insufficient_data', change: 0, volatility: 0 };
    }
    
    const values = data.map(d => d.value);
    const latest = values[values.length - 1];
    const previous = values[values.length - 2];
    const firstValue = values[0];
    
    const recentChange = ((latest - previous) / previous) * 100;
    const totalChange = ((latest - firstValue) / firstValue) * 100;
    
    // Calculate volatility (standard deviation)
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const volatility = Math.sqrt(variance);
    
    let trend = 'stable';
    if (Math.abs(recentChange) > 5) {
      trend = recentChange > 0 ? 'rising' : 'falling';
    }
    
    return {
      trend,
      recent_change: Math.round(recentChange * 100) / 100,
      total_change: Math.round(totalChange * 100) / 100,
      volatility: Math.round(volatility * 100) / 100,
      data_points: data.length
    };
  }

  // Correlate economic data with stock sentiment
  async correlateWithStockSentiment(ticker, sentiment, options = {}) {
    const economicData = await this.getCurrentIndicators();
    
    if (!economicData.indicators || Object.keys(economicData.indicators).length === 0) {
      return {
        ticker,
        sentiment,
        economic_correlation: 'no_data',
        risk_factors: [],
        opportunities: []
      };
    }
    
    const correlation = this.analyzeStockEconomicCorrelation(ticker, sentiment, economicData);
    
    console.log(`📊 Economic correlation for ${ticker}: ${correlation.correlation_strength} correlation`);
    
    return correlation;
  }

  // Analyze correlation between stock sentiment and economic conditions
  analyzeStockEconomicCorrelation(ticker, sentiment, economicData) {
    const context = economicData.market_context;
    const riskFactors = [];
    const opportunities = [];
    let correlationStrength = 'neutral';
    
    // Interest rate sensitivity analysis
    if (context.interest_rate_environment === 'restrictive') {
      if (sentiment > 20) {
        riskFactors.push('High sentiment despite restrictive monetary policy');
      }
      // Growth stocks more sensitive to rates
      riskFactors.push('Rising rates headwind for growth stocks');
    }
    
    // Inflation impact
    if (context.inflation_trend === 'rising') {
      if (sentiment > 30) {
        opportunities.push('Strong sentiment may indicate pricing power');
      } else {
        riskFactors.push('Inflation pressures on margins');
      }
    }
    
    // Economic growth correlation
    if (context.economic_growth === 'weak' && sentiment > 30) {
      riskFactors.push('Bullish sentiment contrasts with weak economic growth');
      correlationStrength = 'negative';
    } else if (context.economic_growth === 'strong' && sentiment > 20) {
      opportunities.push('Positive sentiment aligned with strong economic growth');
      correlationStrength = 'positive';
    }
    
    // Market sentiment correlation
    if (context.market_sentiment === 'fearful' && sentiment > 40) {
      riskFactors.push('High individual stock optimism during market fear');
      correlationStrength = 'divergent';
    }
    
    // Sector-specific insights
    const sectorSignals = context.sector_rotation_signals || [];
    sectorSignals.forEach(signal => {
      if (signal.signal === 'positive') {
        opportunities.push(`${signal.sector} sector rotation: ${signal.reason}`);
      }
    });
    
    return {
      ticker,
      sentiment,
      economic_correlation: correlationStrength,
      risk_factors: riskFactors,
      opportunities,
      market_context: context,
      recommendation: this.generateEconomicRecommendation(sentiment, context, riskFactors, opportunities),
      last_updated: new Date().toISOString()
    };
  }

  // Generate economic-based recommendation
  generateEconomicRecommendation(sentiment, context, riskFactors, opportunities) {
    let score = 50; // Neutral baseline
    
    // Adjust based on economic environment
    if (context.overall_assessment === 'positive') {
      score += 15;
    } else if (context.overall_assessment === 'negative') {
      score -= 15;
    }
    
    // Risk factors reduce score
    score -= riskFactors.length * 5;
    
    // Opportunities increase score
    score += opportunities.length * 3;
    
    // Sentiment-economic alignment
    if (context.economic_growth === 'strong' && sentiment > 20) {
      score += 10;
    } else if (context.economic_growth === 'weak' && sentiment > 30) {
      score -= 10;
    }
    
    score = Math.max(0, Math.min(100, score));
    
    let recommendation = 'hold';
    if (score > 70) {
      recommendation = 'strong_buy';
    } else if (score > 60) {
      recommendation = 'buy';
    } else if (score < 30) {
      recommendation = 'sell';
    } else if (score < 40) {
      recommendation = 'weak_sell';
    }
    
    return {
      recommendation,
      confidence: score,
      economic_support: score > 60 ? 'favorable' : score < 40 ? 'unfavorable' : 'neutral',
      primary_factors: [
        ...riskFactors.slice(0, 2),
        ...opportunities.slice(0, 2)
      ]
    };
  }

  // Get date string in YYYY-MM-DD format
  getDateString(date) {
    return date.toISOString().split('T')[0];
  }

  // Rate limiting
  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    
    if (timeSinceLastRequest < this.minInterval) {
      await this.delay(this.minInterval - timeSinceLastRequest);
    }
    
    this.lastRequest = Date.now();
  }

  // Update usage tracking
  updateUsage() {
    const today = new Date().toISOString().split('T')[0];
    
    if (this.usage.last_reset !== today) {
      this.usage.requests_today = 0;
      this.usage.last_reset = today;
    }
    
    this.usage.requests_today++;
  }

  // Get usage statistics
  getUsageStats() {
    return {
      ...this.usage,
      is_configured: this.isConfigured,
      available_indicators: Object.keys(this.indicators).length,
      cache_size: this.cache.size,
      rate_limit_interval: this.minInterval
    };
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
    console.log('📊 FRED API cache cleared');
  }

  // Utility functions
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

module.exports = new FredService();
