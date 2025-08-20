import axios from 'axios';

class ApiServiceClass {
  constructor() {
    // Determine the base URL dynamically:
    // 1. Respect explicit environment variable if provided
    // 2. In browser context and not running on localhost, use the same origin as the frontend to avoid cross-origin issues
    // 3. Fallback to localhost for local development
    if (process.env.REACT_APP_API_URL) {
      this.baseURL = process.env.REACT_APP_API_URL;
    } else if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      this.baseURL = window.location.origin;
    } else {
      this.baseURL = 'http://localhost:5000';
    }
    this.api = null;
  }

  initialize() {
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for logging
    this.api.interceptors.request.use(
      (config) => {
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => {
        return response.data;
      },
      (error) => {
        console.error('API Response Error:', error.response?.data || error.message);
        if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        throw error;
      }
    );
  }

  // System Health
  async getSystemHealth() {
    return this.api.get('/api/health');
  }

  // Reddit Data Endpoints
  async getTrendingStocks(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.api.get(`/api/reddit/trending?${queryString}`);
  }

  async getStockDiscussions(ticker, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.api.get(`/api/reddit/stock/${ticker}?${queryString}`);
  }

  async getStockSentiment(ticker, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.api.get(`/api/reddit/sentiment/${ticker}?${queryString}`);
  }

  async getQualityUsers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.api.get(`/api/reddit/quality-users?${queryString}`);
  }

  async getProcessingStats() {
    return this.api.get('/api/reddit/stats');
  }

  async getRecentPosts(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.api.get(`/api/reddit/posts/recent?${queryString}`);
  }

  async triggerProcessing() {
    return this.api.post('/api/reddit/process');
  }

  // Enhanced Stock Data Endpoints (Phase 2 & 3)
  async getValidatedTrendingStocks(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.api.get(`/api/stocks/trending/validated?${queryString}`);
  }

  async getTrendingComparison(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.api.get(`/api/stocks/trending/comparison?${queryString}`);
  }

  async getEnhancedStockSentiment(ticker, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.api.get(`/api/stocks/${ticker}/sentiment?${queryString}`);
  }

  // Stock Price Data
  async getStockPrices(ticker, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.api.get(`/api/stocks/prices/${ticker}?${queryString}`);
  }

  async getStockDaily(ticker, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.api.get(`/api/stocks/daily/${ticker}?${queryString}`);
  }

  async getStockIntraday(ticker, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.api.get(`/api/stocks/intraday/${ticker}?${queryString}`);
  }

  async searchStocks(query) {
    return this.api.get(`/api/stocks/search/${query}`);
  }

  async validateTicker(ticker) {
    return this.api.get(`/api/stocks/validate/${ticker}`);
  }

  // Subreddit Management Endpoints
  async getSubreddits() {
    return this.api.get('/api/subreddits');
  }

  async addSubreddit(data) {
    return this.api.post('/api/subreddits', data);
  }

  async updateSubreddit(name, data) {
    return this.api.put(`/api/subreddits/${name}`, data);
  }

  async deleteSubreddit(name) {
    return this.api.delete(`/api/subreddits/${name}`);
  }

  async getSubredditStats(name) {
    return this.api.get(`/api/subreddits/${name}/stats`);
  }

  async getSubredditMetadata(name) {
    return this.api.get(`/api/subreddits/${name}/metadata`);
  }

  async validateSubreddit(data) {
    return this.api.post('/api/subreddits/validate', data);
  }

  async toggleSubreddit(name) {
    return this.api.post(`/api/subreddits/${name}/toggle`);
  }

  async enableSubreddit(name) {
    return this.api.post(`/api/subreddits/${name}/enable`);
  }

  async disableSubreddit(name) {
    return this.api.post(`/api/subreddits/${name}/disable`);
  }

  async crossValidateTicker(data) {
    return this.api.post('/api/subreddits/cross-validate', data);
  }

  async getPerformanceRanking(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.api.get(`/api/subreddits/performance/ranking?${queryString}`);
  }

  // Monitoring Control Endpoints
  async getMonitoringDashboard() {
    return this.api.get('/api/subreddits/monitoring/dashboard');
  }

  async getMonitoringStatus() {
    return this.api.get('/api/subreddits/monitoring/status');
  }

  async startMonitoring() {
    return this.api.post('/api/subreddits/monitoring/start');
  }

  async stopMonitoring() {
    return this.api.post('/api/subreddits/monitoring/stop');
  }

  async processNow() {
    return this.api.post('/api/subreddits/monitoring/process-now');
  }

  // Phase 3 Advanced Analysis Endpoints
  async getComprehensiveStockAnalysis(ticker, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.api.get(`/api/analysis/stocks/${ticker}/comprehensive?${queryString}`);
  }

  async getEnhancedTrendingStocks(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.api.get(`/api/analysis/stocks/enhanced-trending?${queryString}`);
  }

  async getConfidenceAnalysis(ticker, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.api.get(`/api/analysis/confidence/${ticker}?${queryString}`);
  }

  async getBatchConfidenceAnalysis(data) {
    return this.api.post('/api/analysis/confidence/batch', data);
  }

  async getUserReputation(username) {
    return this.api.get(`/api/analysis/users/reputation/${username}`);
  }

  async getTopUsers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.api.get(`/api/analysis/users/top?${queryString}`);
  }

  // News Correlation
  async getTickerNews(ticker, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.api.get(`/api/analysis/news/${ticker}?${queryString}`);
  }

  async getMarketNews(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.api.get(`/api/analysis/news/market?${queryString}`);
  }

  async correlateNews(data) {
    return this.api.post('/api/analysis/news/correlate', data);
  }

  async searchNews(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.api.get(`/api/analysis/news/search?${queryString}`);
  }

  // Economic Data
  async getEconomicIndicators() {
    return this.api.get('/api/analysis/economic/indicators');
  }

  async getEconomicHistory(indicator, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.api.get(`/api/analysis/economic/history/${indicator}?${queryString}`);
  }

  async correlateEconomic(data) {
    return this.api.post('/api/analysis/economic/correlate', data);
  }

  // Claude AI Analysis
  async analyzeSentimentWithClaude(data) {
    return this.api.post('/api/analysis/claude/sentiment', data);
  }

  async batchAnalyzeSentiment(data) {
    return this.api.post('/api/analysis/claude/batch-sentiment', data);
  }

  async analyzeContentQuality(data) {
    return this.api.post('/api/analysis/claude/quality', data);
  }

  async detectManipulation(data) {
    return this.api.post('/api/analysis/claude/detect-manipulation', data);
  }

  async summarizePost(data) {
    return this.api.post('/api/analysis/claude/summarize', data);
  }

  // System Status
  async getAnalysisStatus() {
    return this.api.get('/api/analysis/status');
  }

  async getClaudeUsage() {
    return this.api.get('/api/analysis/claude/usage');
  }

  async getNewsUsage() {
    return this.api.get('/api/analysis/news/usage');
  }

  async getEconomicUsage() {
    return this.api.get('/api/analysis/economic/usage');
  }
}

// Create singleton instance
export const ApiService = new ApiServiceClass();
