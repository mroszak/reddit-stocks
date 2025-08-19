# Reddit Stocks Sentiment Tracker - POC Architecture

## Project Overview

A React/Material-UI application that analyzes stock discussions across top Reddit communities to identify trending stocks and sentiment patterns. The app leverages multiple APIs to provide high-quality data from reputable sources, focusing on user quality metrics, engagement patterns, and cross-validated signals.

## 🎯 Core Objectives

- **Trend Identification**: Discover stocks gaining momentum in Reddit discussions
- **Sentiment Analysis**: Assess bullish/bearish sentiment using advanced NLP
- **Quality Filtering**: Focus on posts from reputable users with proven track records
- **Data Correlation**: Validate Reddit signals against real market data and news
- **Actionable Insights**: Provide clear buy/sell/watch recommendations

## 📊 Available APIs & Data Sources

### 1. Reddit API
**Access**: Client ID & Secret (OAuth 2.0)
- **Rate Limits**: 100 queries/minute per OAuth client
- **Configurable Subreddits**: Dynamic subreddit management via UI
  - **Default Subreddits**:
    - r/stocks (2.8M members)
    - r/investing (1.8M members) 
    - r/StockMarket (5M members)
    - r/SecurityAnalysis (180k members)
    - r/ValueInvesting (200k members)
    - r/wallstreetbets (15M members)
    - r/pennystocks (2M members)
  - **Custom Addition**: Add any public subreddit via interface
  - **Monitoring Controls**: Enable/disable individual subreddits
  - **Quality Metrics**: Track performance of each subreddit's signals

**Data Points**:
- Post metrics: upvotes, comments, awards, age
- User quality: account age, karma, posting history
- Content: ticker mentions, sentiment keywords, DD posts
- Engagement: comment velocity, discussion depth

### 2. AlphaVantage API
**Access**: Free API key (25 requests/day limit)
- **Endpoints**:
  - `TIME_SERIES_INTRADAY`: Real-time price data
  - `TIME_SERIES_DAILY`: Historical daily data
  - `TECHNICAL_INDICATORS`: 50+ technical indicators
  - `SECTOR_PERFORMANCE`: Sector analysis

**Use Cases**:
- Correlate Reddit buzz with price movements
- Validate sentiment against actual performance
- Identify momentum patterns
- Sector-wide trend analysis

### 3. NewsAPI
**Access**: API key available
- **Sources**: Financial news outlets (WSJ, Bloomberg, Reuters, etc.)
- **Search**: Stock ticker-based news retrieval
- **Correlation**: Compare Reddit sentiment vs. mainstream media

### 4. FRED API (Federal Reserve Economic Data)
**Access**: Free API key
- **Economic Indicators**:
  - Interest rates (Fed funds rate, 10-year treasury)
  - Economic growth (GDP, employment data)
  - Market sentiment indicators
  - Inflation metrics

**Use Cases**:
- Provide macro context for stock discussions
- Identify sector rotation patterns
- Correlate economic events with Reddit sentiment shifts

### 5. Claude API (Anthropic)
**Access**: API key available
- **Advanced NLP Capabilities**:
  - Sophisticated sentiment analysis beyond keyword matching
  - Entity extraction (companies, products, events)
  - Summarization of complex DD posts
  - Quality assessment of financial analysis
  - Detection of pump-and-dump schemes

## 🏗️ Application Architecture

### Frontend: React + Material-UI

#### Dashboard Components
1. **Trending Stocks Panel**
   - Real-time stock mentions with sentiment scores
   - Quality indicators (high-reputation user posts)
   - Momentum arrows (increasing/decreasing discussion)
   - Price correlation indicators

2. **Stock Detail View**
   - Sentiment timeline (hourly/daily trends)
   - Key post highlights from quality users
   - Technical analysis mentions
   - News correlation panel
   - Community consensus meter
   - Subreddit breakdown (which communities are discussing)

3. **Market Overview**
   - Sector sentiment heatmap
   - Overall market mood indicator
   - Economic context panel (FRED data)
   - Alert system for significant sentiment shifts

4. **User Quality Dashboard**
   - Top contributors leaderboard
   - Most accurate prediction tracking
   - Reputation scoring system
   - Expert vs. novice sentiment comparison

5. **Subreddit Management Panel** 🆕
   - Add/remove subreddits dynamically
   - Enable/disable monitoring for specific subreddits
   - View subreddit performance metrics
   - Configure posting frequency thresholds
   - Set quality filters per subreddit

#### Key Features
- **Real-time Updates**: WebSocket integration for live data
- **Interactive Charts**: Chart.js for price/sentiment correlation
- **Smart Filtering**: Time ranges, quality thresholds, sentiment strength
- **Dark/Light Themes**: Professional trading interface aesthetic
- **Mobile Responsive**: Full functionality on mobile devices

### Backend: Node.js + Express

#### API Endpoints
```
/api/reddit/trending          # Top mentioned stocks
/api/reddit/stock/:ticker     # Specific stock discussions
/api/sentiment/:ticker        # Claude-powered sentiment analysis
/api/stocks/prices/:ticker    # AlphaVantage price data
/api/news/:ticker            # Related news articles
/api/economic/indicators     # FRED economic context
/api/users/quality/:username # User reputation scoring

# Subreddit Management 🆕
/api/subreddits              # GET: List all configured subreddits
/api/subreddits              # POST: Add new subreddit
/api/subreddits/:name        # PUT: Update subreddit config
/api/subreddits/:name        # DELETE: Remove subreddit
/api/subreddits/:name/stats  # GET: Performance metrics for subreddit
/api/subreddits/validate     # POST: Validate subreddit exists and is accessible
```

#### Data Processing Pipeline
1. **Reddit Data Collection**
   - Continuous monitoring of target subreddits
   - Ticker extraction using regex patterns
   - User reputation calculation
   - Post quality scoring

2. **Enhanced Filtering & Noise Reduction** 🆕
   - Coordinated posting pattern detection
   - Velocity spike analysis (0→100 mentions too fast)
   - Account age and karma validation
   - Cross-subreddit validation requirements
   - Time-decay weighting for recent posts

3. **Sentiment Processing**
   - Claude API for advanced sentiment analysis
   - Keyword-based preliminary scoring
   - Context-aware analysis (sarcasm detection)
   - Confidence level calculation
   - Aggregated sentiment scores

4. **Market Data Correlation**
   - AlphaVantage price data retrieval
   - Technical indicator calculations
   - Price movement correlation analysis
   - Volume spike detection
   - Divergence alerts (sentiment vs. price)

5. **Quality Assessment**
   - User history analysis
   - DD post validation
   - Accuracy tracking for predictions
   - Enhanced trending score calculation
   - Spam/manipulation detection

### Data Storage: MongoDB

#### Collections Structure
```javascript
// Reddit Posts
{
  _id: ObjectId,
  subreddit: String,
  title: String,
  content: String,
  author: String,
  created_utc: Date,
  upvotes: Number,
  comments: Number,
  awards: Number,
  tickers: [String],
  sentiment_score: Number,
  quality_score: Number
}

// Subreddit Configuration 🆕
{
  _id: ObjectId,
  name: String,                 // r/stocks
  display_name: String,         // Stocks
  description: String,
  subscribers: Number,
  is_active: Boolean,           // Enable/disable monitoring
  added_date: Date,
  last_updated: Date,
  config: {
    min_upvotes: Number,        // Minimum upvotes to consider
    min_comments: Number,       // Minimum comments to consider
    quality_threshold: Number,  // User quality score threshold
    max_posts_per_hour: Number, // Rate limiting
    keywords_filter: [String],  // Optional keyword filtering
    exclude_flairs: [String]    // Exclude certain post flairs
  },
  performance_metrics: {
    total_posts_processed: Number,
    successful_predictions: Number,
    accuracy_rate: Number,
    avg_sentiment_accuracy: Number,
    last_calculated: Date
  }
}

// User Profiles
{
  _id: ObjectId,
  username: String,
  account_age: Number,
  karma: Number,
  post_count: Number,
  accuracy_score: Number,
  reputation_tier: String,
  last_updated: Date
}

// Stock Data
{
  _id: ObjectId,
  ticker: String,
  price_data: [{
    timestamp: Date,
    open: Number,
    high: Number,
    low: Number,
    close: Number,
    volume: Number
  }],
  reddit_mentions: Number,
  sentiment_trend: Number,
  last_updated: Date
}
```

## 🧮 Scoring Algorithms

### 1. User Quality Score (0-100)
```javascript
qualityScore = (
  accountAge * 0.2 +        // Older accounts more trusted
  karma * 0.3 +             // Higher karma = better content
  financeSubFreq * 0.3 +    // Finance-focused posting
  accuracyHistory * 0.2     // Track record of predictions
)
```

### 2. Post Quality Score (0-100)
```javascript
postScore = (
  upvoteRatio * 0.25 +      // Community approval
  commentEngagement * 0.25 + // Discussion generated
  userQuality * 0.3 +       // Author reputation
  contentDepth * 0.2        // Analysis vs. meme
)
```

### 3. Sentiment Momentum Score (-100 to +100)
```javascript
momentumScore = (
  recentSentiment * 0.4 +   // Last 24h sentiment
  sentimentVelocity * 0.3 + // Rate of change
  volumeSpike * 0.3         // Discussion volume increase
)
```

### 4. Stock Recommendation Score (0-100)
```javascript
recommendationScore = (
  sentimentScore * 0.25 +   // Community sentiment
  qualityWeighting * 0.3 +  // High-quality user consensus
  priceCorrelation * 0.2 +  // Historical accuracy
  newsAlignment * 0.15 +    // News sentiment match
  economicContext * 0.1     // Macro environment fit
)
```

### 5. Enhanced Trending Score (0-100) 🆕
```javascript
trendingScore = (
  mentionVolume * 0.2 +           // Raw mention count
  sentimentMomentum * 0.25 +      // Sentiment velocity
  qualityUserRatio * 0.3 +        // % from high-rep users
  crossSubredditValidation * 0.15 + // Multiple communities
  timeDecayFactor * 0.1           // Recency weighting
)
```

### 6. Noise Filter Score (0-1) 🆕
```javascript
noiseFilter = (
  minUpvoteThreshold && 
  minCommentThreshold && 
  !coordinatedPostingPattern && 
  !suspiciousVelocitySpike &&
  accountAgeCheck
) ? 1 : 0
```

### 7. Confidence Level (0-100) 🆕
```javascript
confidenceLevel = (
  dataPoints * 0.3 +              // Number of posts analyzed
  userReputationConsensus * 0.4 + // Agreement among quality users
  historicalAccuracy * 0.2 +      // Track record for this stock
  crossValidation * 0.1           // Multiple subreddit agreement
)
```

## 📱 User Interface Design

### Dashboard Layout
```
┌─────────────────────────────────────────────────────────┐
│  📈 Reddit Stocks Sentiment Tracker    ⚙️ Subreddits    │
├─────────────┬───────────────────────┬───────────────────┤
│  Trending   │   Sentiment Timeline  │   Market Context  │
│  Stocks     │                      │                   │
│  ┌─────────┐│  ┌─────────────────┐  │  ┌─────────────┐  │
│  │ $TSLA   ││  │     Chart       │  │  │ S&P 500     │  │
│  │ +85📈🔥 ││  │                 │  │  │ +1.2%       │  │
│  │ 94%🎯   ││  │                 │  │  │             │  │
│  │ r/stocks││  │                 │  │  │ VIX: 18.5   │  │
│  └─────────┘│  └─────────────────┘  │  │ Fear: Low   │  │
│             │                      │  └─────────────┘  │
│  ┌─────────┐│  ┌─────────────────┐  │                   │
│  │ $NVDA   ││  │   News Feed     │  │  ┌─────────────┐  │
│  │ +72💡⚡ ││  │                 │  │  │ Economic    │  │
│  │ 67%🎯   ││  │                 │  │  │ Indicators  │  │
│  │ r/wsb   ││  │                 │  │  │             │  │
│  └─────────┘│  └─────────────────┘  │  └─────────────┘  │
├─────────────┼───────────────────────┼───────────────────┤
│ 🎯 Confidence: 80%+ ⚡ Velocity: High 🔔 Alerts: 3      │
└─────────────────────────────────────────────────────────┘
```

**Legend**: 🔥 = Trending Score >80, 🎯 = Confidence %, ⚡ = High Velocity, 💡 = Medium Quality

### Subreddit Management Interface 🆕
```
┌─────────────────────────────────────────────────────────┐
│  ⚙️ Subreddit Configuration                              │
├─────────────────────────────────────────────────────────┤
│  📊 Active Subreddits (7)                               │
│  ┌─────────────────────────────────────────────────────┐│
│  │ ✅ r/stocks          2.8M │ 🎯 92% │ ⚡ 45/hr │ ⚙️   ││
│  │ ✅ r/investing       1.8M │ 🎯 87% │ ⚡ 32/hr │ ⚙️   ││
│  │ ✅ r/wallstreetbets  15M  │ 🎯 76% │ ⚡ 180/hr│ ⚙️   ││
│  │ ❌ r/pennystocks     2M   │ 🎯 45% │ ⚡ 95/hr │ ⚙️   ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  ➕ Add New Subreddit                                   │
│  ┌─────────────────────────────────────────────────────┐│
│  │ r/[____________] [Validate] [Add] [Browse Popular]   ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  📈 Performance Metrics                                 │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Best Performing: r/SecurityAnalysis (94% accuracy)  ││
│  │ Most Active: r/wallstreetbets (180 posts/hour)      ││
│  │ Hidden Gems: r/investing (high quality, low noise)  ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### Stock Detail View
```
┌─────────────────────────────────────────────────────────┐
│  $TSLA - Tesla Inc.                           $245.67   │
├─────────────────────────────────────────────────────────┤
│  📊 Sentiment: +85 (Very Bullish) ↗️ +12 vs yesterday   │
│  👥 Quality Users: 89% Bullish (34 posts)              │
│  💬 Total Mentions: 1,247 (+45%)                       │
├─────────────────────────────────────────────────────────┤
│  📈 Price/Sentiment Correlation Chart                   │
│  ┌─────────────────────────────────────────────────────┐│
│  │     Price   ■■■ Sentiment ••• Volume ═══           ││
│  │  $250 ┐                                           ││
│  │       │  ■■                                       ││
│  │  $240 ┤    ■■■   •••                              ││
│  │       │       ■■■   •••                           ││
│  │  $230 └─────────────────────────────────────────   ││
│  │       1d    2d    3d    4d    5d                   ││
│  └─────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│  🎯 Top Quality Posts                                   │
│  ┌─────────────────────────────────────────────────────┐│
│  │ u/TeslaAnalyst (98★) - "Q4 delivery numbers..."    ││
│  │ 2.3k upvotes • 456 comments • 24 awards            ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow Architecture

### Real-time Processing Pipeline
```
Reddit API → Data Ingestion → Ticker Extraction → User Scoring
     ↓              ↓              ↓              ↓
Stock Price ← AlphaVantage ← Claude Sentiment ← Quality Filter
     ↓              ↓              ↓              ↓
MongoDB Storage ← Correlation ← Aggregation ← React Frontend
     ↓              ↓              ↓              ↓
WebSocket Updates → Dashboard → Alerts → User Notifications
```

### Batch Processing (Every 15 minutes)
1. **Reddit Data Sync**: Fetch latest posts from all target subreddits
2. **Price Data Update**: Get current prices for all mentioned tickers
3. **Sentiment Recalculation**: Process new posts through Claude API
4. **Trend Analysis**: Calculate momentum and quality scores
5. **Alert Generation**: Identify significant sentiment shifts
6. **Data Cleanup**: Archive old data, update user reputation scores

## 🚨 Key Metrics & Alerts

### Alert Triggers
- **Sentiment Spike**: >50% increase in positive mentions (1 hour)
- **Quality Consensus**: >80% of high-reputation users agree (bullish/bearish)
- **Volume Breakout**: Discussion volume >5x normal levels
- **Price Divergence**: Sentiment vs. price movement contradiction
- **Cross-Community Validation**: Same sentiment across 3+ subreddits
- **Anomaly Detection** 🆕: Unusual posting patterns or coordinated activity
- **Confidence Threshold** 🆕: High confidence signals (>80%) with quality backing
- **Velocity Alerts** 🆕: Stocks gaining momentum faster than normal

### Success Metrics
- **Prediction Accuracy**: Track sentiment→price correlation
- **Quality Signal Strength**: High-reputation user predictions
- **Early Detection**: Time advantage vs. mainstream news
- **False Positive Rate**: Minimize noise and manipulation
- **User Engagement**: Dashboard usage and alert utility

## 🔧 Implementation Phases

### Phase 1: Core Data Pipeline (Week 1-2)
- [ ] Reddit API integration and authentication
- [ ] Basic ticker extraction from posts
- [ ] AlphaVantage price data retrieval
- [ ] MongoDB schema setup (including subreddit config)
- [ ] Simple sentiment scoring
- [ ] **Enhanced**: Basic noise filtering (upvote/comment thresholds)
- [ ] **Enhanced**: Time-decay weighting for posts

### Phase 2: Subreddit Management System (Week 3)
- [ ] Subreddit configuration database schema
- [ ] API endpoints for subreddit CRUD operations
- [ ] Subreddit validation and metadata fetching
- [ ] Performance metrics calculation
- [ ] Dynamic monitoring enable/disable
- [ ] **Enhanced**: Cross-subreddit validation logic

### Phase 3: Advanced Analysis (Week 4-5)
- [ ] Claude API integration for sophisticated sentiment
- [ ] User reputation scoring system
- [ ] Post quality assessment algorithms
- [ ] News API integration for correlation
- [ ] FRED economic data integration
- [ ] **Enhanced**: Confidence level calculation
- [ ] **Enhanced**: Trending score algorithm
- [ ] **Enhanced**: Coordinated posting detection

### Phase 4: Frontend Development (Week 6-7)
- [ ] React/MUI dashboard structure
- [ ] Trending stocks panel with enhanced indicators
- [ ] Stock detail views with charts
- [ ] Subreddit management interface
- [ ] Real-time updates via WebSocket
- [ ] Mobile responsive design
- [ ] **Enhanced**: Confidence and velocity indicators
- [ ] **Enhanced**: Visual noise filtering controls

### Phase 5: Intelligence Layer (Week 8)
- [ ] Correlation analysis algorithms
- [ ] Enhanced alert system implementation
- [ ] Recommendation scoring
- [ ] Performance tracking
- [ ] Subreddit performance analytics
- [ ] **Enhanced**: Anomaly detection alerts
- [ ] **Enhanced**: Price divergence notifications

## 🛡️ Risk Mitigation

### Data Quality Controls
- **Manipulation Detection**: Identify coordinated posting patterns
- **Spam Filtering**: Remove low-quality, repetitive content
- **User Validation**: Cross-reference account age and posting history
- **Sentiment Validation**: Compare Claude results with keyword-based analysis

### API Rate Limit Management
- **Caching Strategy**: Store frequently accessed data locally
- **Request Optimization**: Batch requests where possible
- **Fallback Systems**: Alternative data sources when APIs are unavailable
- **Cost Monitoring**: Track usage to avoid unexpected charges

### Performance Optimization
- **Database Indexing**: Optimize queries for real-time performance
- **CDN Integration**: Fast content delivery for global users
- **Lazy Loading**: Load components only when needed
- **Data Pagination**: Handle large datasets efficiently

## 🎯 Success Criteria

### Technical Goals
- [ ] 99.5% uptime for data collection
- [ ] <2 second dashboard load times
- [ ] Real-time updates within 30 seconds
- [ ] Support for 100+ concurrent users
- [ ] 90%+ sentiment analysis accuracy

### Business Goals
- [ ] Identify 3+ high-conviction stock picks weekly
- [ ] 70%+ accuracy on 7-day price movement predictions
- [ ] Early detection advantage of 2+ hours vs. mainstream news
- [ ] User engagement: 15+ minutes average session time
- [ ] Community validation: Cross-subreddit signal confirmation

## 🚀 Future Enhancements

### Advanced Features (Post-POC)
- **Machine Learning Models**: Custom sentiment models trained on financial data
- **Options Flow Integration**: Correlate Reddit sentiment with options activity
- **Earnings Calendar**: Align sentiment tracking with earnings releases
- **Insider Trading Tracking**: Monitor for potential insider information
- **Portfolio Simulation**: Paper trading based on Reddit signals
- **API Monetization**: Provide sentiment data to institutional investors

### Scaling Considerations
- **Multi-platform Support**: Twitter, Discord, Telegram integration
- **International Markets**: Expand beyond US stocks
- **Real-time Chat**: Community discussion features
- **Premium Tiers**: Advanced analytics for power users
- **Mobile App**: Native iOS/Android applications

---

*This POC architecture provides a solid foundation for building a sophisticated Reddit-based stock sentiment tracker that delivers high-quality, actionable insights through a professional interface.*
