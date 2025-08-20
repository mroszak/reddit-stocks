const fs = require('fs');
const path = require('path');

class TickerExtractor {
  constructor() {
    this.tickerPatterns = [
      // Standard format: $TICKER
      /\$([A-Z]{1,5})\b/g,
      
      // Spaces around ticker: $ TICKER or TICKER $
      /\$\s*([A-Z]{1,5})\b/g,
      /\b([A-Z]{1,5})\s*\$/g,
      
      // Ticker in parentheses: (TICKER)
      /\(([A-Z]{1,5})\)/g,
      
      // Ticker with colon: TICKER:
      /\b([A-Z]{1,5}):/g,
      
      // Common stock mention patterns
      /\b([A-Z]{1,5})\s+stock\b/gi,
      /\bstock\s+([A-Z]{1,5})\b/gi,
      /\b([A-Z]{1,5})\s+shares?\b/gi,
      /\bshares?\s+of\s+([A-Z]{1,5})\b/gi,
      
      // Company ticker patterns
      /\b([A-Z]{1,5})\s+(?:calls?|puts?|options?)\b/gi,
      /\b(?:calls?|puts?|options?)\s+(?:on\s+)?([A-Z]{1,5})\b/gi
    ];

    // Common false positives to filter out
    this.excludedWords = new Set([
      'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE',
      'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'ITS', 'MAY', 'NEW', 'NOW',
      'OLD', 'SEE', 'TWO', 'WHO', 'BOY', 'DID', 'HAS', 'LET', 'PUT', 'SAY', 'SHE', 'TOO',
      'USE', 'WAY', 'WIN', 'YES', 'YET', 'TRY', 'TOP', 'TEN', 'SIX', 'RUN', 'RED', 'OWN',
      'OFF', 'LOT', 'LET', 'LAW', 'JOB', 'ILL', 'HOT', 'HIT', 'GOT', 'GOD', 'FUN', 'FEW',
      'FAR', 'END', 'EAR', 'EAT', 'DOG', 'CUT', 'CRY', 'COP', 'CAR', 'BOX', 'BIG', 'BED',
      'BAG', 'ASK', 'ARM', 'AGE', 'ADD', 'ACT', 'USD', 'CEO', 'IPO', 'SEC', 'FDA', 'ETF',
      'NYSE', 'API', 'URL', 'PDF', 'LOL', 'OMG', 'WTF', 'TBH', 'IMO', 'FOMO', 'YOLO', 'DD',
      'TA', 'FA', 'PT', 'PT', 'EOD', 'AH', 'PM', 'AM', 'EDIT', 'TLDR', 'ELI', 'AMA',
      // Protocol and URL-related false positives
      'HTTP', 'HTTPS', 'WWW', 'COM', 'NET', 'ORG', 'EDU', 'GOV', 'MIL', 'INT', 'FTP',
      'SMTP', 'DNS', 'SSH', 'SSL', 'TLS', 'HTML', 'CSS', 'JSON', 'XML', 'RSS',
      // Common tech/abbreviation false positives
      'INFO', 'DATA', 'MAIN', 'FILE', 'PAGE', 'SITE', 'HOME', 'NEWS', 'BLOG', 'HELP'
    ]);

    // Known valid tickers (this would ideally be loaded from a comprehensive list)
    this.knownTickers = new Set([
      'AAPL', 'GOOGL', 'GOOG', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'DIS',
      'BABA', 'V', 'JPM', 'JNJ', 'WMT', 'PG', 'UNH', 'HD', 'MA', 'PYPL', 'ADBE', 'PFE',
      'VZ', 'KO', 'NKE', 'MRK', 'T', 'INTC', 'CRM', 'ABT', 'NFLX', 'TMO', 'COST', 'AVGO',
      'ACN', 'TXN', 'LLY', 'DHR', 'QCOM', 'NEE', 'BMY', 'PM', 'MDT', 'UNP', 'LOW', 'AMD',
      'AMGN', 'BA', 'IBM', 'SPGI', 'GS', 'CAT', 'SYK', 'TJX', 'GILD', 'CVX', 'AXP', 'BLK',
      'AMT', 'ISRG', 'MO', 'ZTS', 'NOW', 'RTX', 'DE', 'SCHW', 'PLD', 'MMM', 'CI', 'TMUS',
      'EL', 'MDLZ', 'CB', 'EQIX', 'SHW', 'DUK', 'BSX', 'ANTM', 'SO', 'ITW', 'CL', 'NSC',
      'HUM', 'AON', 'VRTX', 'MMC', 'APD', 'CME', 'FISV', 'TGT', 'ETN', 'FCX', 'PSA', 'ICE',
      'GD', 'CSX', 'USB', 'MCO', 'PNC', 'EMR', 'WM', 'KLAC', 'ADI', 'COP', 'SBUX', 'LRCX',
      'SPY', 'QQQ', 'IWM', 'VTI', 'VOO', 'VEA', 'IEFA', 'AGG', 'BND', 'VWO', 'IEMG', 'IJH',
      'IJR', 'IVV', 'VIG', 'VXUS', 'GLD', 'SLV', 'ARKK', 'ARKQ', 'ARKW', 'ARKG', 'ARKF',
      'GME', 'AMC', 'BB', 'NOK', 'PLTR', 'NIO', 'XPEV', 'LI', 'BABA', 'JD', 'PDD', 'DIDI'
    ]);

    // Cryptocurrency symbols that might be mistaken for stocks
    this.cryptoSymbols = new Set([
      'BTC', 'ETH', 'ADA', 'DOT', 'XRP', 'LTC', 'BCH', 'BNB', 'SOL', 'DOGE', 'SHIB',
      'MATIC', 'AVAX', 'LUNA', 'FTT', 'UNI', 'LINK', 'ATOM', 'VET', 'ICP', 'THETA',
      'FIL', 'TRX', 'ETC', 'XLM', 'AAVE', 'CAKE', 'ALGO', 'XTZ', 'EGLD', 'HBAR'
    ]);
  }

  // Extract ticker symbols from text
  extractTickers(text, title = '') {
    if (!text && !title) return [];

    const combinedText = `${title} ${text}`.toUpperCase();
    const foundTickers = new Map(); // Use Map to track mentions and confidence

    // Apply all ticker patterns
    for (const pattern of this.tickerPatterns) {
      const matches = combinedText.matchAll(pattern);
      
      for (const match of matches) {
        const ticker = match[1]?.trim();
        if (!ticker || ticker.length < 1 || ticker.length > 5) continue;

        // Skip if it's in our excluded words
        if (this.excludedWords.has(ticker)) continue;

        // Skip if it's a known cryptocurrency
        if (this.cryptoSymbols.has(ticker)) continue;

        // Calculate confidence based on context and known tickers
        const confidence = this.calculateTickerConfidence(ticker, match[0], combinedText);
        
        if (confidence > 0.3) { // Minimum confidence threshold
          if (foundTickers.has(ticker)) {
            // Increment mention count and update confidence
            const existing = foundTickers.get(ticker);
            foundTickers.set(ticker, {
              mentions: existing.mentions + 1,
              confidence: Math.max(existing.confidence, confidence)
            });
          } else {
            foundTickers.set(ticker, {
              mentions: 1,
              confidence: confidence
            });
          }
        }
      }
    }

    // Convert Map to array format expected by our schema
    return Array.from(foundTickers.entries()).map(([symbol, data]) => ({
      symbol,
      mentions: data.mentions,
      confidence: data.confidence
    }));
  }

  // Calculate confidence score for a ticker mention
  calculateTickerConfidence(ticker, fullMatch, context) {
    let confidence = 0.5; // Base confidence

    // Higher confidence for known tickers
    if (this.knownTickers.has(ticker)) {
      confidence += 0.3;
    }

    // Higher confidence for standard format ($TICKER)
    if (fullMatch.includes('$')) {
      confidence += 0.2;
    }

    // Higher confidence for stock-related context
    const stockKeywords = [
      'stock', 'share', 'buy', 'sell', 'hold', 'call', 'put', 'option', 'price',
      'earnings', 'dividend', 'market', 'trade', 'invest', 'portfolio', 'analyst',
      'target', 'bull', 'bear', 'moon', 'rocket', 'dd', 'yolo'
    ];

    const contextLower = context.toLowerCase();
    for (const keyword of stockKeywords) {
      if (contextLower.includes(keyword)) {
        confidence += 0.1;
        break; // Only add bonus once for stock context
      }
    }

    // Reduce confidence for very common English words that might be false positives
    const commonWords = ['CAN', 'NOW', 'ALL', 'GET', 'NEW', 'SEE', 'TWO', 'OLD'];
    if (commonWords.includes(ticker)) {
      confidence -= 0.3;
    }

    // Reduce confidence for tickers that appear in non-financial context
    const nonFinancialKeywords = ['game', 'movie', 'song', 'book', 'food', 'travel'];
    for (const keyword of nonFinancialKeywords) {
      if (contextLower.includes(keyword)) {
        confidence -= 0.2;
        break;
      }
    }

    // Ensure confidence is within bounds
    return Math.max(0, Math.min(1, confidence));
  }

  // Validate ticker format
  isValidTickerFormat(ticker) {
    return /^[A-Z]{1,5}$/.test(ticker) && !this.excludedWords.has(ticker);
  }

  // Get ticker mentions with context
  extractTickersWithContext(text, title = '') {
    const tickers = this.extractTickers(text, title);
    const combinedText = `${title} ${text}`;
    
    return tickers.map(ticker => {
      const context = this.extractTickerContext(ticker.symbol, combinedText);
      return {
        ...ticker,
        context
      };
    });
  }

  // Extract surrounding context for a ticker mention
  extractTickerContext(ticker, text, windowSize = 50) {
    const regex = new RegExp(`\\b${ticker}\\b`, 'gi');
    const matches = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      const start = Math.max(0, match.index - windowSize);
      const end = Math.min(text.length, match.index + ticker.length + windowSize);
      const context = text.substring(start, end).trim();
      
      matches.push({
        context,
        position: match.index,
        fullMatch: match[0]
      });
    }

    return matches;
  }

  // Batch process multiple texts
  batchExtractTickers(posts) {
    return posts.map(post => {
      const tickers = this.extractTickers(post.content, post.title);
      return {
        ...post,
        tickers
      };
    });
  }

  // Get statistics about ticker extraction
  getExtractionStats(posts) {
    const stats = {
      totalPosts: posts.length,
      postsWithTickers: 0,
      uniqueTickers: new Set(),
      totalMentions: 0,
      averageConfidence: 0,
      topTickers: new Map()
    };

    let totalConfidence = 0;
    let totalTickerPosts = 0;

    posts.forEach(post => {
      const tickers = this.extractTickers(post.content, post.title);
      
      if (tickers.length > 0) {
        stats.postsWithTickers++;
        totalTickerPosts++;
        
        tickers.forEach(ticker => {
          stats.uniqueTickers.add(ticker.symbol);
          stats.totalMentions += ticker.mentions;
          totalConfidence += ticker.confidence;
          
          // Track top tickers
          if (stats.topTickers.has(ticker.symbol)) {
            stats.topTickers.set(ticker.symbol, stats.topTickers.get(ticker.symbol) + ticker.mentions);
          } else {
            stats.topTickers.set(ticker.symbol, ticker.mentions);
          }
        });
      }
    });

    stats.averageConfidence = totalTickerPosts > 0 ? totalConfidence / totalTickerPosts : 0;
    stats.uniqueTickersCount = stats.uniqueTickers.size;
    
    // Convert top tickers to sorted array
    stats.topTickersArray = Array.from(stats.topTickers.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    return stats;
  }

  // Add ticker to known tickers list (for learning)
  addKnownTicker(ticker) {
    if (this.isValidTickerFormat(ticker)) {
      this.knownTickers.add(ticker.toUpperCase());
      return true;
    }
    return false;
  }

  // Remove ticker from known tickers (for false positives)
  removeKnownTicker(ticker) {
    return this.knownTickers.delete(ticker.toUpperCase());
  }

  // Get current known tickers count
  getKnownTickersCount() {
    return this.knownTickers.size;
  }
}

module.exports = new TickerExtractor();
