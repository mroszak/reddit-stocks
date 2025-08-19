const snoowrap = require('snoowrap');
const moment = require('moment');

class RedditService {
  constructor() {
    this.client = null;
    this.isAuthenticated = false;
    this.lastRequestTime = 0;
    this.requestCount = 0;
    this.rateLimitWindow = 60 * 1000; // 1 minute in milliseconds
    this.maxRequestsPerWindow = 100; // Reddit API limit
  }

  // Initialize Reddit API client
  async initialize() {
    try {
      if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) {
        throw new Error('Reddit API credentials not configured');
      }

      this.client = new snoowrap({
        userAgent: 'RedditStocksSentimentTracker/1.0.0 by u/rondorocket',
        clientId: process.env.REDDIT_CLIENT_ID,
        clientSecret: process.env.REDDIT_CLIENT_SECRET,
        username: process.env.REDDIT_USERNAME,
        password: process.env.REDDIT_PASSWORD
      });

      // Test the connection
      await this.client.getMe();
      this.isAuthenticated = true;
      console.log('✅ Reddit API authenticated successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Reddit API authentication failed:', error.message);
      this.isAuthenticated = false;
      return false;
    }
  }

  // Rate limiting check
  async checkRateLimit() {
    const now = Date.now();
    
    // Reset counter if window has passed
    if (now - this.lastRequestTime > this.rateLimitWindow) {
      this.requestCount = 0;
      this.lastRequestTime = now;
    }

    // Check if we've hit the limit
    if (this.requestCount >= this.maxRequestsPerWindow) {
      const waitTime = this.rateLimitWindow - (now - this.lastRequestTime);
      console.log(`⏳ Rate limit reached, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.lastRequestTime = Date.now();
    }

    this.requestCount++;
  }

  // Get posts from a specific subreddit
  async getSubredditPosts(subredditName, options = {}) {
    if (!this.isAuthenticated) {
      await this.initialize();
    }

    await this.checkRateLimit();

    try {
      const {
        sort = 'hot',
        timeframe = 'day',
        limit = 100,
        minUpvotes = 5,
        minComments = 2
      } = options;

      console.log(`📥 Fetching posts from r/${subredditName} (${sort}, limit: ${limit})`);

      const subreddit = this.client.getSubreddit(subredditName);
      let posts;

      switch (sort) {
        case 'hot':
          posts = await subreddit.getHot({ limit });
          break;
        case 'new':
          posts = await subreddit.getNew({ limit });
          break;
        case 'top':
          posts = await subreddit.getTop({ time: timeframe, limit });
          break;
        case 'rising':
          posts = await subreddit.getRising({ limit });
          break;
        default:
          posts = await subreddit.getHot({ limit });
      }

      // Filter posts based on minimum criteria
      const filteredPosts = posts.filter(post => {
        return (
          post.ups >= minUpvotes &&
          post.num_comments >= minComments &&
          !post.is_self || (post.is_self && post.selftext && post.selftext.length > 50)
        );
      });

      console.log(`✅ Retrieved ${filteredPosts.length} filtered posts from r/${subredditName}`);
      
      return filteredPosts.map(post => this.formatPostData(post, subredditName));
    } catch (error) {
      console.error(`❌ Error fetching posts from r/${subredditName}:`, error.message);
      throw error;
    }
  }

  // Get multiple subreddits' posts
  async getMultipleSubredditsPosts(subredditConfigs, options = {}) {
    const results = [];
    
    for (const config of subredditConfigs) {
      try {
        const posts = await this.getSubredditPosts(config.name, {
          ...options,
          minUpvotes: config.config.min_upvotes,
          minComments: config.config.min_comments,
          limit: Math.min(options.limit || 50, config.config.max_posts_per_hour)
        });
        
        results.push({
          subreddit: config.name,
          posts,
          success: true
        });
        
        // Small delay between subreddit requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Failed to fetch from r/${config.name}:`, error.message);
        results.push({
          subreddit: config.name,
          posts: [],
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  // Get user information
  async getUserInfo(username) {
    if (!this.isAuthenticated) {
      await this.initialize();
    }

    await this.checkRateLimit();

    try {
      const user = await this.client.getUser(username).fetch();
      
      // Calculate account age in days
      const accountAge = user.created_utc ? 
        Math.floor((Date.now() - user.created_utc * 1000) / (1000 * 60 * 60 * 24)) : 0;
      
      // Get karma values with fallbacks
      const totalKarma = typeof user.total_karma === 'number' ? user.total_karma : 
                        (typeof user.link_karma === 'number' && typeof user.comment_karma === 'number' ? 
                         user.link_karma + user.comment_karma : 0);
      
      return {
        username: user.name || username,
        account_age: accountAge,
        karma: totalKarma,
        link_karma: typeof user.link_karma === 'number' ? user.link_karma : 0,
        comment_karma: typeof user.comment_karma === 'number' ? user.comment_karma : 0,
        is_verified: !!user.verified,
        is_gold: !!user.is_gold,
        created_utc: user.created_utc ? new Date(user.created_utc * 1000) : new Date()
      };
    } catch (error) {
      console.error(`❌ Error fetching user info for ${username}:`, error.message);
      return null;
    }
  }

  // Validate if subreddit exists and is accessible
  async validateSubreddit(subredditName) {
    if (!this.isAuthenticated) {
      await this.initialize();
    }

    await this.checkRateLimit();

    try {
      const subreddit = this.client.getSubreddit(subredditName);
      const info = await subreddit.fetch();
      
      return {
        valid: true,
        name: info.display_name,
        display_name: info.display_name_prefixed,
        description: info.public_description,
        subscribers: info.subscribers,
        is_public: !info.subreddit_type || info.subreddit_type === 'public',
        created_utc: new Date(info.created_utc * 1000),
        over18: info.over18
      };
    } catch (error) {
      console.error(`❌ Subreddit validation failed for r/${subredditName}:`, error.message);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  // Format post data for our database schema
  formatPostData(post, subredditName) {
    return {
      reddit_id: post.id,
      subreddit: subredditName,
      title: post.title,
      content: post.selftext || '',
      url: post.url || '',
      author: post.author.name,
      author_flair: post.author_flair_text || '',
      upvotes: post.ups,
      upvote_ratio: post.upvote_ratio,
      comments: post.num_comments,
      awards: post.total_awards_received || 0,
      created_utc: new Date(post.created_utc * 1000),
      collected_at: new Date(),
      processed: false
    };
  }

  // Search for posts containing specific keywords
  async searchPosts(query, subredditName = null, options = {}) {
    if (!this.isAuthenticated) {
      await this.initialize();
    }

    await this.checkRateLimit();

    try {
      const {
        sort = 'relevance',
        timeframe = 'week',
        limit = 50
      } = options;

      let searchResults;
      
      if (subredditName) {
        const subreddit = this.client.getSubreddit(subredditName);
        searchResults = await subreddit.search({
          query,
          sort,
          time: timeframe,
          limit
        });
      } else {
        searchResults = await this.client.search({
          query,
          sort,
          time: timeframe,
          limit
        });
      }

      return searchResults.map(post => this.formatPostData(post, post.subreddit.display_name));
    } catch (error) {
      console.error(`❌ Error searching posts with query "${query}":`, error.message);
      throw error;
    }
  }

  // Get trending posts across multiple subreddits
  async getTrendingPosts(subredditNames, options = {}) {
    const allPosts = [];
    
    for (const subredditName of subredditNames) {
      try {
        const posts = await this.getSubredditPosts(subredditName, {
          ...options,
          sort: 'hot',
          limit: 25
        });
        allPosts.push(...posts);
      } catch (error) {
        console.error(`❌ Error getting trending posts from r/${subredditName}:`, error.message);
      }
    }

    // Sort by engagement score (upvotes + comments)
    return allPosts
      .map(post => ({
        ...post,
        engagement_score: post.upvotes + (post.comments * 2)
      }))
      .sort((a, b) => b.engagement_score - a.engagement_score)
      .slice(0, options.limit || 100);
  }

  // Get detailed subreddit metadata for performance metrics
  async getSubredditMetadata(subredditName) {
    if (!this.isAuthenticated) {
      await this.initialize();
    }

    await this.checkRateLimit();

    try {
      const subreddit = this.client.getSubreddit(subredditName);
      const info = await subreddit.fetch();
      
      // Get recent posts to analyze activity
      const recentPosts = await this.getSubredditPosts(subredditName, {
        sort: 'new',
        limit: 100
      });

      // Calculate activity metrics
      const now = Date.now();
      const last24h = recentPosts.filter(post => 
        now - new Date(post.created_utc).getTime() < 24 * 60 * 60 * 1000
      );
      const lastWeek = recentPosts.filter(post => 
        now - new Date(post.created_utc).getTime() < 7 * 24 * 60 * 60 * 1000
      );

      return {
        name: info.display_name,
        display_name: info.display_name_prefixed,
        description: info.public_description,
        long_description: info.description,
        subscribers: info.subscribers,
        active_users: info.accounts_active,
        is_public: !info.subreddit_type || info.subreddit_type === 'public',
        created_utc: new Date(info.created_utc * 1000),
        over18: info.over18,
        language: info.lang || 'en',
        activity_metrics: {
          posts_last_24h: last24h.length,
          posts_last_week: lastWeek.length,
          avg_upvotes_24h: last24h.length > 0 ? 
            last24h.reduce((sum, p) => sum + p.upvotes, 0) / last24h.length : 0,
          avg_comments_24h: last24h.length > 0 ? 
            last24h.reduce((sum, p) => sum + p.comments, 0) / last24h.length : 0,
          estimated_posts_per_hour: last24h.length / 24
        }
      };
    } catch (error) {
      console.error(`❌ Failed to get metadata for r/${subredditName}:`, error.message);
      throw error;
    }
  }

  // Cross-subreddit validation for signal confirmation
  async validateSignalAcrossSubreddits(ticker, subredditNames, timeframe = 24) {
    const results = [];
    const cutoffTime = Date.now() - (timeframe * 60 * 60 * 1000);

    for (const subredditName of subredditNames) {
      try {
        // Search for posts mentioning the ticker
        const posts = await this.searchPosts(`$${ticker}`, subredditName, {
          timeframe: timeframe > 24 ? 'week' : 'day',
          limit: 50
        });

        // Filter by timeframe and analyze
        const recentPosts = posts.filter(post => 
          new Date(post.created_utc).getTime() > cutoffTime
        );

        if (recentPosts.length > 0) {
          const totalUpvotes = recentPosts.reduce((sum, p) => sum + p.upvotes, 0);
          const totalComments = recentPosts.reduce((sum, p) => sum + p.comments, 0);
          const avgEngagement = (totalUpvotes + totalComments) / recentPosts.length;

          results.push({
            subreddit: subredditName,
            mentions: recentPosts.length,
            avg_engagement: avgEngagement,
            posts: recentPosts.slice(0, 5), // Top 5 posts for analysis
            confidence_score: Math.min(100, recentPosts.length * 10 + avgEngagement / 10)
          });
        }
      } catch (error) {
        console.error(`❌ Cross-validation failed for r/${subredditName}:`, error.message);
        results.push({
          subreddit: subredditName,
          mentions: 0,
          avg_engagement: 0,
          posts: [],
          confidence_score: 0,
          error: error.message
        });
      }
    }

    // Calculate overall validation score
    const validSubreddits = results.filter(r => r.mentions > 0);
    const totalMentions = validSubreddits.reduce((sum, r) => sum + r.mentions, 0);
    const avgConfidence = validSubreddits.length > 0 ? 
      validSubreddits.reduce((sum, r) => sum + r.confidence_score, 0) / validSubreddits.length : 0;

    return {
      ticker,
      timeframe_hours: timeframe,
      subreddits_checked: subredditNames.length,
      subreddits_with_mentions: validSubreddits.length,
      total_mentions: totalMentions,
      cross_validation_score: validSubreddits.length >= 2 ? avgConfidence : avgConfidence * 0.5,
      is_validated: validSubreddits.length >= 2 && totalMentions >= 3,
      results
    };
  }

  // Check API status
  getStatus() {
    return {
      authenticated: this.isAuthenticated,
      requests_made: this.requestCount,
      rate_limit_window: this.rateLimitWindow,
      max_requests_per_window: this.maxRequestsPerWindow,
      time_until_reset: this.rateLimitWindow - (Date.now() - this.lastRequestTime)
    };
  }
}

module.exports = new RedditService();
