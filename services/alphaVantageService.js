const axios = require('axios');

class AlphaVantageService {
  constructor() {
    this.apiKey = process.env.ALPHAVANTAGE_KEY;
    this.baseUrl = 'https://www.alphavantage.co/query';
    this.requestCount = 0;
    this.dailyLimit = 25; // Free tier limit
    this.lastRequestTime = 0;
    this.minRequestInterval = 12000; // 12 seconds between requests (5 per minute max)
  }

  // Check if we can make a request
  canMakeRequest() {
    const now = Date.now();
    const today = new Date().toDateString();
    const lastRequestDay = new Date(this.lastRequestTime).toDateString();

    // Reset daily counter if it's a new day
    if (today !== lastRequestDay) {
      this.requestCount = 0;
    }

    // Check daily limit
    if (this.requestCount >= this.dailyLimit) {
      return {
        canRequest: false,
        reason: 'Daily limit reached',
        remainingRequests: 0,
        nextResetTime: new Date(new Date().setHours(24, 0, 0, 0))
      };
    }

    // Check rate limiting
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      return {
        canRequest: false,
        reason: 'Rate limit',
        waitTime: waitTime,
        remainingRequests: this.dailyLimit - this.requestCount
      };
    }

    return {
      canRequest: true,
      remainingRequests: this.dailyLimit - this.requestCount
    };
  }

  // Wait for rate limit if necessary
  async waitForRateLimit() {
    const status = this.canMakeRequest();
    if (!status.canRequest && status.waitTime) {
      console.log(`⏳ Rate limiting: waiting ${status.waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, status.waitTime));
    }
  }

  // Make API request with error handling
  async makeRequest(params) {
    if (!this.apiKey) {
      throw new Error('AlphaVantage API key not configured');
    }

    await this.waitForRateLimit();

    const status = this.canMakeRequest();
    if (!status.canRequest) {
      throw new Error(`Cannot make request: ${status.reason}`);
    }

    try {
      this.requestCount++;
      this.lastRequestTime = Date.now();

      const response = await axios.get(this.baseUrl, {
        params: {
          ...params,
          apikey: this.apiKey
        },
        timeout: 30000
      });

      console.log(`📊 AlphaVantage API request: ${params.function} for ${params.symbol || 'N/A'}`);
      
      // Check for API error messages
      if (response.data['Error Message']) {
        throw new Error(`AlphaVantage API Error: ${response.data['Error Message']}`);
      }

      if (response.data['Note']) {
        throw new Error(`AlphaVantage API Note: ${response.data['Note']}`);
      }

      return response.data;
    } catch (error) {
      console.error('❌ AlphaVantage API request failed:', error.message);
      throw error;
    }
  }

  // Get real-time quote for a symbol
  async getQuote(symbol) {
    try {
      const data = await this.makeRequest({
        function: 'GLOBAL_QUOTE',
        symbol: symbol.toUpperCase()
      });

      const quote = data['Global Quote'];
      if (!quote || Object.keys(quote).length === 0) {
        throw new Error(`No quote data found for ${symbol}`);
      }

      return {
        symbol: quote['01. symbol'],
        open: parseFloat(quote['02. open']),
        high: parseFloat(quote['03. high']),
        low: parseFloat(quote['04. low']),
        price: parseFloat(quote['05. price']),
        volume: parseInt(quote['06. volume']),
        latest_trading_day: quote['07. latest trading day'],
        previous_close: parseFloat(quote['08. previous close']),
        change: parseFloat(quote['09. change']),
        change_percent: quote['10. change percent'].replace('%', ''),
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`❌ Error getting quote for ${symbol}:`, error.message);
      throw error;
    }
  }

  // Get intraday price data
  async getIntradayData(symbol, interval = '5min') {
    try {
      const data = await this.makeRequest({
        function: 'TIME_SERIES_INTRADAY',
        symbol: symbol.toUpperCase(),
        interval: interval,
        outputsize: 'compact'
      });

      const timeSeriesKey = `Time Series (${interval})`;
      const timeSeries = data[timeSeriesKey];
      
      if (!timeSeries) {
        throw new Error(`No intraday data found for ${symbol}`);
      }

      const priceData = [];
      for (const [timestamp, values] of Object.entries(timeSeries)) {
        priceData.push({
          timestamp: new Date(timestamp),
          open: parseFloat(values['1. open']),
          high: parseFloat(values['2. high']),
          low: parseFloat(values['3. low']),
          close: parseFloat(values['4. close']),
          volume: parseInt(values['5. volume'])
        });
      }

      // Sort by timestamp (newest first)
      priceData.sort((a, b) => b.timestamp - a.timestamp);

      return {
        symbol: data['Meta Data']['2. Symbol'],
        interval: data['Meta Data']['4. Interval'],
        last_refreshed: data['Meta Data']['3. Last Refreshed'],
        timezone: data['Meta Data']['6. Time Zone'],
        data: priceData
      };
    } catch (error) {
      console.error(`❌ Error getting intraday data for ${symbol}:`, error.message);
      throw error;
    }
  }

  // Get daily price data
  async getDailyData(symbol, outputSize = 'compact') {
    try {
      const data = await this.makeRequest({
        function: 'TIME_SERIES_DAILY',
        symbol: symbol.toUpperCase(),
        outputsize: outputSize
      });

      const timeSeries = data['Time Series (Daily)'];
      if (!timeSeries) {
        throw new Error(`No daily data found for ${symbol}`);
      }

      const priceData = [];
      for (const [date, values] of Object.entries(timeSeries)) {
        priceData.push({
          timestamp: new Date(date),
          open: parseFloat(values['1. open']),
          high: parseFloat(values['2. high']),
          low: parseFloat(values['3. low']),
          close: parseFloat(values['4. close']),
          volume: parseInt(values['5. volume'])
        });
      }

      // Sort by timestamp (newest first)
      priceData.sort((a, b) => b.timestamp - a.timestamp);

      return {
        symbol: data['Meta Data']['2. Symbol'],
        last_refreshed: data['Meta Data']['3. Last Refreshed'],
        timezone: data['Meta Data']['5. Time Zone'],
        data: priceData
      };
    } catch (error) {
      console.error(`❌ Error getting daily data for ${symbol}:`, error.message);
      throw error;
    }
  }

  // Get technical indicators
  async getTechnicalIndicator(symbol, indicator, interval = 'daily', timePeriod = 20) {
    try {
      const data = await this.makeRequest({
        function: indicator.toUpperCase(),
        symbol: symbol.toUpperCase(),
        interval: interval,
        time_period: timePeriod
      });

      const indicatorKey = `Technical Analysis: ${indicator.toUpperCase()}`;
      const indicatorData = data[indicatorKey];
      
      if (!indicatorData) {
        throw new Error(`No ${indicator} data found for ${symbol}`);
      }

      const processedData = [];
      for (const [timestamp, values] of Object.entries(indicatorData)) {
        const entry = {
          timestamp: new Date(timestamp)
        };

        // Add all indicator values
        for (const [key, value] of Object.entries(values)) {
          const cleanKey = key.replace(/^\d+\.\s*/, ''); // Remove "1. " prefix
          entry[cleanKey] = parseFloat(value);
        }

        processedData.push(entry);
      }

      // Sort by timestamp (newest first)
      processedData.sort((a, b) => b.timestamp - a.timestamp);

      return {
        symbol: data['Meta Data']['1: Symbol'],
        indicator: data['Meta Data']['2: Indicator'],
        last_refreshed: data['Meta Data']['3: Last Refreshed'],
        interval: data['Meta Data']['4: Interval'],
        time_period: data['Meta Data']['5: Time Period'],
        data: processedData
      };
    } catch (error) {
      console.error(`❌ Error getting ${indicator} for ${symbol}:`, error.message);
      throw error;
    }
  }

  // Get multiple quotes efficiently
  async getMultipleQuotes(symbols, maxConcurrent = 3) {
    const results = [];
    const chunks = [];
    
    // Split symbols into chunks to respect rate limits
    for (let i = 0; i < symbols.length; i += maxConcurrent) {
      chunks.push(symbols.slice(i, i + maxConcurrent));
    }

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (symbol) => {
        try {
          const quote = await this.getQuote(symbol);
          return { symbol, quote, success: true };
        } catch (error) {
          console.error(`❌ Failed to get quote for ${symbol}:`, error.message);
          return { symbol, error: error.message, success: false };
        }
      });

      const chunkResults = await Promise.allSettled(chunkPromises);
      results.push(...chunkResults.map(result => 
        result.status === 'fulfilled' ? result.value : { 
          symbol: 'unknown', 
          error: result.reason?.message || 'Unknown error', 
          success: false 
        }
      ));

      // Wait between chunks to respect rate limits
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, this.minRequestInterval));
      }
    }

    return results;
  }

  // Search for symbol (useful for validation)
  async searchSymbol(keywords) {
    try {
      const data = await this.makeRequest({
        function: 'SYMBOL_SEARCH',
        keywords: keywords
      });

      const matches = data['bestMatches'] || [];
      
      return matches.map(match => ({
        symbol: match['1. symbol'],
        name: match['2. name'],
        type: match['3. type'],
        region: match['4. region'],
        marketOpen: match['5. marketOpen'],
        marketClose: match['6. marketClose'],
        timezone: match['7. timezone'],
        currency: match['8. currency'],
        matchScore: parseFloat(match['9. matchScore'])
      }));
    } catch (error) {
      console.error(`❌ Error searching for symbol ${keywords}:`, error.message);
      throw error;
    }
  }

  // Get sector performance
  async getSectorPerformance() {
    try {
      const data = await this.makeRequest({
        function: 'SECTOR'
      });

      return {
        realtime_performance: data['Rank A: Real-Time Performance'],
        one_day_performance: data['Rank B: 1 Day Performance'],
        five_day_performance: data['Rank C: 5 Day Performance'],
        one_month_performance: data['Rank D: 1 Month Performance'],
        three_month_performance: data['Rank E: 3 Month Performance'],
        year_to_date_performance: data['Rank F: Year-to-Date (YTD) Performance'],
        one_year_performance: data['Rank G: 1 Year Performance'],
        last_updated: data['Meta Data']['Last Refreshed']
      };
    } catch (error) {
      console.error('❌ Error getting sector performance:', error.message);
      throw error;
    }
  }

  // Validate if a symbol exists
  async validateSymbol(symbol) {
    try {
      const searchResults = await this.searchSymbol(symbol);
      const exactMatch = searchResults.find(result => 
        result.symbol.toUpperCase() === symbol.toUpperCase()
      );
      
      if (exactMatch) {
        return {
          valid: true,
          symbol: exactMatch.symbol,
          name: exactMatch.name,
          type: exactMatch.type,
          region: exactMatch.region,
          currency: exactMatch.currency
        };
      }

      // If no exact match, try to get a quote (sometimes search fails but quote works)
      try {
        const quote = await this.getQuote(symbol);
        return {
          valid: true,
          symbol: quote.symbol,
          name: 'Unknown',
          type: 'Equity',
          region: 'United States',
          currency: 'USD'
        };
      } catch (quoteError) {
        return {
          valid: false,
          symbol: symbol,
          error: 'Symbol not found'
        };
      }
    } catch (error) {
      console.error(`❌ Error validating symbol ${symbol}:`, error.message);
      return {
        valid: false,
        symbol: symbol,
        error: error.message
      };
    }
  }

  // Get API usage statistics
  getUsageStats() {
    const today = new Date().toDateString();
    const lastRequestDay = new Date(this.lastRequestTime).toDateString();
    
    return {
      requests_today: today === lastRequestDay ? this.requestCount : 0,
      daily_limit: this.dailyLimit,
      remaining_requests: this.dailyLimit - (today === lastRequestDay ? this.requestCount : 0),
      last_request_time: new Date(this.lastRequestTime),
      min_request_interval_ms: this.minRequestInterval,
      next_reset_time: new Date(new Date().setHours(24, 0, 0, 0))
    };
  }
}

module.exports = new AlphaVantageService();
