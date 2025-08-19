const axios = require('axios');
require('dotenv').config();

class NewsService {
  constructor() {
    this.apiKey = process.env.NEWS_API_KEY || '';
    this.baseUrl = 'https://newsapi.org/v2';
    this.isConfigured = !!this.apiKey;
    
    // Rate limiting - NewsAPI free tier: 1000 requests/day, 100 requests/day for developer plan
    this.lastRequest = 0;
    this.minInterval = 1000; // 1 second between requests
    this.dailyLimit = 900; // Conservative limit
    
    // Usage tracking
    this.usage = {
      requests_today: 0,
      last_reset: new Date().toISOString().split('T')[0]
    };
    
    // Cache for news articles
    this.cache = new Map();
    this.cacheTimeout = 15 * 60 * 1000; // 15 minutes
    
    if (!this.isConfigured) {
      console.log('⚠️  NewsAPI not configured - news correlation features disabled');
    } else {
      console.log('✅ NewsAPI configured successfully');
    }
  }

  // Get news articles for a specific ticker
  async getTickerNews(ticker, options = {}) {
    if (!this.isConfigured) {
      console.log('NewsAPI not available, returning empty news data');
      return { articles: [], total: 0, ticker };
    }

    const {
      timeframe = '7d', // 1d, 3d, 7d, 30d
      language = 'en',
      sortBy = 'publishedAt',
      pageSize = 20
    } = options;

    const cacheKey = `ticker_${ticker}_${timeframe}_${pageSize}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log(`📰 Using cached news for ${ticker}`);
        return cached.data;
      }
    }

    try {
      await this.enforceRateLimit();
      
      const fromDate = this.getFromDate(timeframe);
      const query = this.buildTickerQuery(ticker);
      
      const response = await axios.get(`${this.baseUrl}/everything`, {
        params: {
          q: query,
          from: fromDate,
          language,
          sortBy,
          pageSize,
          apiKey: this.apiKey
        }
      });

      this.updateUsage();
      
      const processedArticles = this.processArticles(response.data.articles, ticker);
      
      const result = {
        ticker,
        articles: processedArticles,
        total: response.data.totalResults,
        timeframe,
        last_updated: new Date().toISOString()
      };
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      console.log(`📰 Fetched ${processedArticles.length} news articles for ${ticker}`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ NewsAPI error for ${ticker}:`, error.message);
      return { articles: [], total: 0, ticker, error: error.message };
    }
  }

  // Get general market news
  async getMarketNews(options = {}) {
    if (!this.isConfigured) {
      return { articles: [], total: 0, category: 'market' };
    }

    const {
      category = 'business',
      country = 'us',
      pageSize = 50,
      timeframe = '1d'
    } = options;

    const cacheKey = `market_${category}_${timeframe}_${pageSize}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log(`📰 Using cached market news`);
        return cached.data;
      }
    }

    try {
      await this.enforceRateLimit();
      
      const fromDate = this.getFromDate(timeframe);
      
      const response = await axios.get(`${this.baseUrl}/top-headlines`, {
        params: {
          category,
          country,
          pageSize,
          from: fromDate,
          apiKey: this.apiKey
        }
      });

      this.updateUsage();
      
      const processedArticles = this.processArticles(response.data.articles);
      
      const result = {
        category,
        articles: processedArticles,
        total: response.data.totalResults,
        timeframe,
        last_updated: new Date().toISOString()
      };
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      console.log(`📰 Fetched ${processedArticles.length} market news articles`);
      
      return result;
      
    } catch (error) {
      console.error('❌ NewsAPI error for market news:', error.message);
      return { articles: [], total: 0, category, error: error.message };
    }
  }

  // Correlate Reddit sentiment with news sentiment
  async correlateWithRedditSentiment(ticker, redditSentiment, options = {}) {
    const news = await this.getTickerNews(ticker, options);
    
    if (news.articles.length === 0) {
      return {
        ticker,
        correlation: 'no_news_data',
        reddit_sentiment: redditSentiment,
        news_sentiment: 0,
        correlation_strength: 0,
        articles_analyzed: 0,
        divergence_alerts: []
      };
    }

    // Analyze news sentiment
    const newsSentiment = this.analyzeNewsListSentiment(news.articles);
    
    // Calculate correlation
    const correlation = this.calculateSentimentCorrelation(redditSentiment, newsSentiment);
    
    // Detect divergences
    const divergenceAlerts = this.detectDivergences(redditSentiment, newsSentiment, ticker);
    
    console.log(`📊 Sentiment correlation for ${ticker}: Reddit ${redditSentiment.toFixed(1)}, News ${newsSentiment.avg_sentiment.toFixed(1)}`);
    
    return {
      ticker,
      reddit_sentiment: redditSentiment,
      news_sentiment: newsSentiment,
      correlation: correlation.direction,
      correlation_strength: correlation.strength,
      articles_analyzed: news.articles.length,
      divergence_alerts,
      news_summary: this.summarizeNewsImpact(news.articles),
      last_updated: new Date().toISOString()
    };
  }

  // Batch correlate multiple tickers
  async batchCorrelateNews(tickers, redditSentiments, options = {}) {
    if (!this.isConfigured) {
      return tickers.map((ticker, i) => ({
        ticker,
        correlation: 'news_api_unavailable',
        reddit_sentiment: redditSentiments[i] || 0
      }));
    }

    console.log(`🔄 Starting news correlation for ${tickers.length} tickers`);
    
    const results = [];
    const maxConcurrent = 3; // Conservative to respect rate limits
    const chunks = this.chunkArray(tickers, maxConcurrent);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const promises = chunk.map(async (ticker, j) => {
        const globalIndex = i * maxConcurrent + j;
        const redditSentiment = redditSentiments[globalIndex] || 0;
        return await this.correlateWithRedditSentiment(ticker, redditSentiment, options);
      });
      
      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults);
      
      // Wait between chunks to respect rate limits
      if (i < chunks.length - 1) {
        await this.delay(3000);
      }
    }
    
    console.log(`✅ News correlation complete: ${results.length} tickers analyzed`);
    return results;
  }

  // Search for specific financial events or topics
  async searchFinancialNews(query, options = {}) {
    if (!this.isConfigured) {
      return { articles: [], total: 0, query };
    }

    const {
      timeframe = '7d',
      language = 'en',
      sortBy = 'relevancy',
      pageSize = 30
    } = options;

    try {
      await this.enforceRateLimit();
      
      const fromDate = this.getFromDate(timeframe);
      const enhancedQuery = `${query} AND (stocks OR market OR trading OR investment OR earnings OR financial)`;
      
      const response = await axios.get(`${this.baseUrl}/everything`, {
        params: {
          q: enhancedQuery,
          from: fromDate,
          language,
          sortBy,
          pageSize,
          apiKey: this.apiKey
        }
      });

      this.updateUsage();
      
      const processedArticles = this.processArticles(response.data.articles);
      
      console.log(`🔍 Found ${processedArticles.length} news articles for query: ${query}`);
      
      return {
        query,
        articles: processedArticles,
        total: response.data.totalResults,
        timeframe,
        last_updated: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ NewsAPI search error for "${query}":`, error.message);
      return { articles: [], total: 0, query, error: error.message };
    }
  }

  // Build ticker-specific search query
  buildTickerQuery(ticker) {
    // Common company name mappings for better search results
    const companyMappings = {
      'AAPL': 'Apple',
      'MSFT': 'Microsoft',
      'GOOGL': 'Google Alphabet',
      'AMZN': 'Amazon',
      'TSLA': 'Tesla',
      'META': 'Meta Facebook',
      'NVDA': 'NVIDIA',
      'NFLX': 'Netflix',
      'DIS': 'Disney',
      'BABA': 'Alibaba'
    };
    
    const companyName = companyMappings[ticker] || '';
    
    if (companyName) {
      return `"${ticker}" OR "${companyName}" AND (stock OR shares OR earnings OR financial OR market)`;
    } else {
      return `"${ticker}" AND (stock OR shares OR earnings OR financial OR market)`;
    }
  }

  // Process and enrich articles
  processArticles(articles, ticker = null) {
    return articles
      .filter(article => article.title && article.description && article.url)
      .map(article => {
        const sentiment = this.analyzeArticleSentiment(article);
        const relevance = ticker ? this.calculateRelevance(article, ticker) : 1.0;
        
        return {
          title: article.title,
          description: article.description,
          url: article.url,
          source: article.source.name,
          published_at: article.publishedAt,
          sentiment_score: sentiment.score,
          sentiment_confidence: sentiment.confidence,
          relevance_score: relevance,
          key_mentions: ticker ? this.extractTickerMentions(article, ticker) : [],
          category: this.categorizeArticle(article),
          impact_level: this.assessImpactLevel(article, sentiment.score)
        };
      })
      .sort((a, b) => {
        // Sort by relevance and recency
        const relevanceScore = (b.relevance_score - a.relevance_score) * 100;
        const timeScore = new Date(b.published_at) - new Date(a.published_at);
        return relevanceScore + (timeScore / 1000000); // Scale time difference
      });
  }

  // Simple sentiment analysis for news articles
  analyzeArticleSentiment(article) {
    const text = `${article.title} ${article.description}`.toLowerCase();
    
    // Positive news indicators
    const positiveWords = [
      'profit', 'gain', 'rise', 'growth', 'increase', 'up', 'positive', 'strong',
      'beat', 'exceed', 'outperform', 'upgrade', 'bullish', 'optimistic',
      'breakthrough', 'success', 'victory', 'achievement', 'record', 'high'
    ];
    
    // Negative news indicators
    const negativeWords = [
      'loss', 'fall', 'decline', 'decrease', 'down', 'negative', 'weak',
      'miss', 'disappoint', 'underperform', 'downgrade', 'bearish', 'pessimistic',
      'crisis', 'problem', 'issue', 'concern', 'risk', 'warning', 'low'
    ];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    positiveWords.forEach(word => {
      if (text.includes(word)) positiveCount++;
    });
    
    negativeWords.forEach(word => {
      if (text.includes(word)) negativeCount++;
    });
    
    const totalWords = positiveCount + negativeCount;
    const score = totalWords > 0 ? 
      ((positiveCount - negativeCount) / totalWords) * 100 : 0;
    
    const confidence = Math.min(1, totalWords / 3); // More sentiment words = higher confidence
    
    return {
      score: Math.max(-100, Math.min(100, score)),
      confidence: Math.round(confidence * 100) / 100
    };
  }

  // Analyze sentiment across multiple articles
  analyzeNewsListSentiment(articles) {
    if (articles.length === 0) {
      return { avg_sentiment: 0, confidence: 0, distribution: { positive: 0, negative: 0, neutral: 0 } };
    }

    const sentiments = articles.map(article => article.sentiment_score);
    const avgSentiment = sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length;
    
    const confidences = articles.map(article => article.sentiment_confidence);
    const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    
    const distribution = {
      positive: sentiments.filter(s => s > 10).length,
      negative: sentiments.filter(s => s < -10).length,
      neutral: sentiments.filter(s => s >= -10 && s <= 10).length
    };

    return {
      avg_sentiment: Math.round(avgSentiment * 100) / 100,
      confidence: Math.round(avgConfidence * 100) / 100,
      distribution: {
        positive: Math.round((distribution.positive / articles.length) * 100),
        negative: Math.round((distribution.negative / articles.length) * 100),
        neutral: Math.round((distribution.neutral / articles.length) * 100)
      },
      total_articles: articles.length
    };
  }

  // Calculate correlation between Reddit and news sentiment
  calculateSentimentCorrelation(redditSentiment, newsSentiment) {
    const reddit = redditSentiment;
    const news = newsSentiment.avg_sentiment;
    
    const difference = Math.abs(reddit - news);
    const average = (Math.abs(reddit) + Math.abs(news)) / 2;
    
    let strength = 0;
    let direction = 'neutral';
    
    if (average > 0) {
      strength = Math.max(0, 1 - (difference / 100)); // Normalize to 0-1
      
      if (reddit > 10 && news > 10) {
        direction = 'positive_aligned';
      } else if (reddit < -10 && news < -10) {
        direction = 'negative_aligned';
      } else if ((reddit > 10 && news < -10) || (reddit < -10 && news > 10)) {
        direction = 'divergent';
      } else {
        direction = 'mixed';
      }
    }
    
    return {
      strength: Math.round(strength * 100) / 100,
      direction,
      reddit_sentiment: reddit,
      news_sentiment: news,
      difference: Math.round(difference * 100) / 100
    };
  }

  // Detect significant divergences between Reddit and news sentiment
  detectDivergences(redditSentiment, newsSentiment, ticker) {
    const alerts = [];
    const reddit = redditSentiment;
    const news = newsSentiment.avg_sentiment;
    const difference = Math.abs(reddit - news);
    
    // Strong divergence alert
    if (difference > 50 && Math.abs(reddit) > 20 && Math.abs(news) > 20) {
      alerts.push({
        type: 'strong_divergence',
        severity: 'high',
        message: `Strong sentiment divergence for ${ticker}: Reddit ${reddit.toFixed(1)} vs News ${news.toFixed(1)}`,
        difference: difference
      });
    }
    
    // Reddit bullish, news bearish
    if (reddit > 30 && news < -20) {
      alerts.push({
        type: 'reddit_bullish_news_bearish',
        severity: 'medium',
        message: `Reddit bullish but news bearish for ${ticker}`,
        reddit_sentiment: reddit,
        news_sentiment: news
      });
    }
    
    // Reddit bearish, news bullish
    if (reddit < -30 && news > 20) {
      alerts.push({
        type: 'reddit_bearish_news_bullish',
        severity: 'medium',
        message: `Reddit bearish but news bullish for ${ticker}`,
        reddit_sentiment: reddit,
        news_sentiment: news
      });
    }
    
    return alerts;
  }

  // Calculate article relevance to ticker
  calculateRelevance(article, ticker) {
    const text = `${article.title} ${article.description}`.toLowerCase();
    const tickerLower = ticker.toLowerCase();
    
    let score = 0;
    
    // Direct ticker mention
    if (text.includes(`$${tickerLower}`) || text.includes(tickerLower)) {
      score += 0.5;
    }
    
    // Title mention (more important)
    if (article.title.toLowerCase().includes(tickerLower)) {
      score += 0.3;
    }
    
    // Financial keywords
    const financialKeywords = ['earnings', 'revenue', 'profit', 'stock', 'shares', 'market', 'trading', 'analyst'];
    financialKeywords.forEach(keyword => {
      if (text.includes(keyword)) score += 0.05;
    });
    
    return Math.min(1, score);
  }

  // Extract ticker mentions from article
  extractTickerMentions(article, ticker) {
    const text = `${article.title} ${article.description}`;
    const mentions = [];
    
    // Look for various forms of ticker mentions
    const patterns = [
      new RegExp(`\\$${ticker}\\b`, 'gi'),
      new RegExp(`\\b${ticker}\\b`, 'gi'),
      new RegExp(`${ticker}\\s+stock`, 'gi'),
      new RegExp(`${ticker}\\s+shares`, 'gi')
    ];
    
    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        mentions.push(...matches);
      }
    });
    
    return [...new Set(mentions)]; // Remove duplicates
  }

  // Categorize article type
  categorizeArticle(article) {
    const title = article.title.toLowerCase();
    const desc = article.description.toLowerCase();
    const text = `${title} ${desc}`;
    
    if (text.includes('earnings') || text.includes('quarterly')) return 'earnings';
    if (text.includes('analyst') || text.includes('rating') || text.includes('upgrade') || text.includes('downgrade')) return 'analyst';
    if (text.includes('merger') || text.includes('acquisition') || text.includes('deal')) return 'corporate_action';
    if (text.includes('sec') || text.includes('lawsuit') || text.includes('investigation')) return 'regulatory';
    if (text.includes('ceo') || text.includes('executive') || text.includes('management')) return 'leadership';
    if (text.includes('product') || text.includes('launch') || text.includes('technology')) return 'product';
    
    return 'general';
  }

  // Assess potential market impact
  assessImpactLevel(article, sentimentScore) {
    const title = article.title.toLowerCase();
    const source = article.source.name.toLowerCase();
    
    // High impact sources
    const highImpactSources = ['reuters', 'bloomberg', 'wall street journal', 'cnbc', 'marketwatch'];
    const isHighImpactSource = highImpactSources.some(s => source.includes(s));
    
    // High impact keywords
    const highImpactKeywords = ['earnings', 'sec', 'fda', 'bankruptcy', 'merger', 'acquisition', 'lawsuit'];
    const hasHighImpactKeyword = highImpactKeywords.some(k => title.includes(k));
    
    if (isHighImpactSource && hasHighImpactKeyword && Math.abs(sentimentScore) > 30) {
      return 'high';
    } else if ((isHighImpactSource || hasHighImpactKeyword) && Math.abs(sentimentScore) > 20) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  // Summarize news impact
  summarizeNewsImpact(articles) {
    if (articles.length === 0) {
      return { summary: 'No news articles found', key_themes: [] };
    }

    const categories = {};
    const sources = {};
    const themes = {};
    
    articles.forEach(article => {
      // Count categories
      categories[article.category] = (categories[article.category] || 0) + 1;
      
      // Count sources
      sources[article.source] = (sources[article.source] || 0) + 1;
      
      // Extract themes from titles
      const words = article.title.toLowerCase().split(' ').filter(w => w.length > 4);
      words.forEach(word => {
        themes[word] = (themes[word] || 0) + 1;
      });
    });
    
    const topCategory = Object.keys(categories).reduce((a, b) => categories[a] > categories[b] ? a : b);
    const topThemes = Object.entries(themes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([theme]) => theme);
    
    const avgImpact = articles.reduce((sum, a) => {
      const impactScore = a.impact_level === 'high' ? 3 : a.impact_level === 'medium' ? 2 : 1;
      return sum + impactScore;
    }, 0) / articles.length;
    
    return {
      summary: `${articles.length} articles analyzed, primary focus: ${topCategory}`,
      key_themes: topThemes,
      primary_category: topCategory,
      avg_impact_level: avgImpact > 2.5 ? 'high' : avgImpact > 1.5 ? 'medium' : 'low',
      source_diversity: Object.keys(sources).length,
      high_impact_articles: articles.filter(a => a.impact_level === 'high').length
    };
  }

  // Get date for API queries
  getFromDate(timeframe) {
    const now = new Date();
    const days = {
      '1d': 1,
      '3d': 3,
      '7d': 7,
      '30d': 30
    };
    
    const daysToSubtract = days[timeframe] || 7;
    const fromDate = new Date(now.getTime() - (daysToSubtract * 24 * 60 * 60 * 1000));
    
    return fromDate.toISOString().split('T')[0];
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
    
    if (this.usage.requests_today > this.dailyLimit) {
      console.warn(`⚠️  NewsAPI daily limit (${this.dailyLimit}) exceeded`);
    }
  }

  // Get usage statistics
  getUsageStats() {
    return {
      ...this.usage,
      daily_limit: this.dailyLimit,
      is_configured: this.isConfigured,
      cache_size: this.cache.size,
      rate_limit_interval: this.minInterval
    };
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
    console.log('📰 NewsAPI cache cleared');
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

module.exports = new NewsService();
