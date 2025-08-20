const SubredditConfig = require('../models/SubredditConfig');
const redditService = require('./redditService');
const dataProcessor = require('./dataProcessor');

class MonitoringService {
  constructor() {
    this.isRunning = false;
    this.processInterval = null;
    this.intervalMinutes = 15; // Default 15-minute processing cycle
  }

  // Start automated monitoring
  async startMonitoring(intervalMinutes = 15) {
    if (this.isRunning) {
      console.log('⚠️ Monitoring is already running');
      return false;
    }

    this.intervalMinutes = intervalMinutes;
    this.isRunning = true;

    console.log(`🚀 Starting automated monitoring (${intervalMinutes} minute intervals)`);
    
    // Run initial process
    await this.processActiveSubreddits();

    // Set up interval
    this.processInterval = setInterval(async () => {
      await this.processActiveSubreddits();
    }, intervalMinutes * 60 * 1000);

    return true;
  }

  // Stop automated monitoring
  stopMonitoring() {
    if (!this.isRunning) {
      console.log('⚠️ Monitoring is not running');
      return false;
    }

    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }

    this.isRunning = false;
    console.log('🛑 Automated monitoring stopped');
    return true;
  }

  // Process all active subreddits
  async processActiveSubreddits() {
    try {
      console.log('🔄 Starting automated subreddit processing cycle...');
      
      // Get active subreddits that can be scraped
      const activeSubreddits = await SubredditConfig.find({
        is_active: true,
        'rate_limiting.is_rate_limited': { $ne: true }
      }).sort({ 'performance_metrics.accuracy_rate': -1 });

      console.log(`📊 Found ${activeSubreddits.length} active subreddits to process`);

      if (activeSubreddits.length === 0) {
        console.log('⚠️ No active subreddits available for processing');
        return { success: true, processed: 0, message: 'No active subreddits' };
      }

      // Filter subreddits that can actually be scraped
      const scrapableSubreddits = activeSubreddits.filter(sub => sub.canScrape());
      console.log(`✅ ${scrapableSubreddits.length} subreddits are ready for scraping`);

      if (scrapableSubreddits.length === 0) {
        console.log('⏳ All subreddits are rate limited or inactive');
        return { success: true, processed: 0, message: 'All subreddits rate limited' };
      }

      // Process data from scrapable subreddits
      const results = await redditService.getMultipleSubredditsPosts(scrapableSubreddits, {
        limit: 50,
        sort: 'hot'
      });

      let totalProcessed = 0;
      const processingResults = [];

      for (const result of results) {
        if (result.success && result.posts.length > 0) {
          try {
            // Update rate limiting for the subreddit
            const subreddit = scrapableSubreddits.find(s => s.name === result.subreddit);
            if (subreddit) {
              subreddit.updateRateLimit();
              subreddit.last_scraped = new Date();
              await subreddit.save();
            }

            // Process the posts
            const processed = await dataProcessor.processRedditPosts(result.posts, result.subreddit);
            totalProcessed += processed.length;

            processingResults.push({
              subreddit: result.subreddit,
              posts_received: result.posts.length,
              posts_processed: processed.length,
              success: true
            });

            console.log(`✅ r/${result.subreddit}: ${processed.length}/${result.posts.length} posts processed`);
          } catch (error) {
            console.error(`❌ Error processing r/${result.subreddit}:`, error.message);
            processingResults.push({
              subreddit: result.subreddit,
              posts_received: result.posts.length,
              posts_processed: 0,
              success: false,
              error: error.message
            });
          }
        } else {
          processingResults.push({
            subreddit: result.subreddit,
            posts_received: 0,
            posts_processed: 0,
            success: false,
            error: result.error || 'No posts retrieved'
          });
        }
      }

      console.log(`🎉 Processing cycle complete: ${totalProcessed} total posts processed`);

      return {
        success: true,
        processed: totalProcessed,
        subreddits_processed: scrapableSubreddits.length,
        results: processingResults,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Error in automated processing cycle:', error.message);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Enable monitoring for a specific subreddit
  async enableSubredditMonitoring(subredditName) {
    try {
      const subreddit = await SubredditConfig.findOne({ 
        name: subredditName.toLowerCase() 
      });

      if (!subreddit) {
        throw new Error(`Subreddit r/${subredditName} not found`);
      }

      if (subreddit.is_active) {
        return { success: true, message: `r/${subredditName} is already active` };
      }

      subreddit.is_active = true;
      subreddit.last_updated = new Date();
      await subreddit.save();

      console.log(`✅ Enabled monitoring for r/${subredditName}`);
      return { success: true, message: `Monitoring enabled for r/${subredditName}` };

    } catch (error) {
      console.error(`❌ Failed to enable monitoring for r/${subredditName}:`, error.message);
      throw error;
    }
  }

  // Disable monitoring for a specific subreddit
  async disableSubredditMonitoring(subredditName) {
    try {
      const subreddit = await SubredditConfig.findOne({ 
        name: subredditName.toLowerCase() 
      });

      if (!subreddit) {
        throw new Error(`Subreddit r/${subredditName} not found`);
      }

      if (!subreddit.is_active) {
        return { success: true, message: `r/${subredditName} is already inactive` };
      }

      subreddit.is_active = false;
      subreddit.last_updated = new Date();
      await subreddit.save();

      console.log(`🔕 Disabled monitoring for r/${subredditName}`);
      return { success: true, message: `Monitoring disabled for r/${subredditName}` };

    } catch (error) {
      console.error(`❌ Failed to disable monitoring for r/${subredditName}:`, error.message);
      throw error;
    }
  }

  // Bulk enable/disable monitoring
  async bulkToggleMonitoring(subredditNames, enable = true) {
    const results = [];
    
    for (const name of subredditNames) {
      try {
        if (enable) {
          await this.enableSubredditMonitoring(name);
        } else {
          await this.disableSubredditMonitoring(name);
        }
        
        results.push({
          subreddit: name,
          success: true,
          action: enable ? 'enabled' : 'disabled'
        });
      } catch (error) {
        results.push({
          subreddit: name,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    return {
      success: true,
      results,
      total: subredditNames.length,
      successful: successCount,
      failed: subredditNames.length - successCount
    };
  }

  // Get monitoring status
  getMonitoringStatus() {
    return {
      is_running: this.isRunning,
      interval_minutes: this.intervalMinutes,
      next_cycle: this.processInterval ? 
        new Date(Date.now() + this.intervalMinutes * 60 * 1000).toISOString() : null,
      uptime: this.isRunning ? 'active' : 'inactive'
    };
  }

  // Get comprehensive monitoring dashboard data
  async getMonitoringDashboard() {
    try {
      const subreddits = await SubredditConfig.find({})
        .sort({ 'performance_metrics.accuracy_rate': -1 });

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const activeSubreddits = subreddits.filter(s => s.is_active);
      const scrapableSubreddits = activeSubreddits.filter(s => s.canScrape());
      const rateLimitedSubreddits = subreddits.filter(s => s.rate_limiting.is_rate_limited);
      
      const recentlyScraped = subreddits.filter(s => 
        s.last_scraped && s.last_scraped > oneDayAgo
      );

      const topPerformers = subreddits
        .filter(s => s.performance_metrics.total_predictions > 10)
        .slice(0, 5);

      const summary = {
        total_subreddits: subreddits.length,
        active_subreddits: activeSubreddits.length,
        scrapable_subreddits: scrapableSubreddits.length,
        rate_limited_subreddits: rateLimitedSubreddits.length,
        recently_scraped: recentlyScraped.length,
        monitoring_status: this.getMonitoringStatus(),
        performance: {
          avg_accuracy: subreddits.length > 0 ? 
            subreddits.reduce((sum, s) => sum + s.performance_metrics.accuracy_rate, 0) / subreddits.length : 0,
          total_posts_24h: subreddits.reduce((sum, s) => sum + s.performance_metrics.posts_last_24h, 0),
          top_performers: topPerformers.map(s => ({
            name: s.name,
            accuracy_rate: s.performance_metrics.accuracy_rate,
            performance_score: s.performance_score
          }))
        }
      };

      return {
        success: true,
        data: {
          summary,
          subreddits: subreddits.map(s => ({
            name: s.name,
            display_name: s.display_name,
            is_active: s.is_active,
            can_scrape: s.canScrape(),
            rate_limited: s.rate_limiting.is_rate_limited,
            last_scraped: s.last_scraped,
            performance_score: s.performance_score,
            posts_last_24h: s.performance_metrics.posts_last_24h,
            accuracy_rate: s.performance_metrics.accuracy_rate,
            subscribers: s.subscribers
          }))
        },
        metadata: {
          generated_at: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('❌ Error generating monitoring dashboard:', error.message);
      throw error;
    }
  }
}

module.exports = new MonitoringService();
