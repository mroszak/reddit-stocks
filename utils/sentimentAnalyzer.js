class SentimentAnalyzer {
  constructor() {
    // Positive sentiment keywords with weights
    this.positiveKeywords = new Map([
      // Strong positive (high weight)
      ['moon', 3.0], ['rocket', 3.0], ['bullish', 2.5], ['buying', 2.0], ['buy', 2.0],
      ['calls', 2.0], ['long', 2.0], ['pump', 2.5], ['rally', 2.5], ['surge', 2.5],
      ['breakout', 2.5], ['gains', 2.0], ['profit', 2.0], ['winning', 2.0],
      
      // Moderate positive
      ['good', 1.5], ['great', 2.0], ['excellent', 2.0], ['amazing', 2.0], ['awesome', 2.0],
      ['strong', 1.5], ['solid', 1.5], ['positive', 1.5], ['optimistic', 1.5], ['confident', 1.5],
      ['promising', 1.5], ['potential', 1.0], ['opportunity', 1.5], ['upward', 1.5], ['up', 1.0],
      
      // Mild positive
      ['ok', 0.5], ['okay', 0.5], ['decent', 1.0], ['fine', 0.5], ['nice', 1.0],
      ['better', 1.0], ['improved', 1.0], ['recovery', 1.5], ['rebound', 1.5],
      
      // Finance-specific positive
      ['beat', 2.0], ['exceeded', 2.0], ['outperform', 2.0], ['upgrade', 2.0], ['target', 1.5],
      ['dividend', 1.0], ['earnings', 1.0], ['revenue', 1.0], ['growth', 1.5], ['expansion', 1.5],
      ['partnership', 1.0], ['acquisition', 1.0], ['merger', 1.0], ['ipo', 1.0],
      
      // Meme/Reddit specific positive
      ['diamond', 2.0], ['hands', 1.5], ['hold', 1.0], ['hodl', 1.5], ['ape', 1.0],
      ['retard', 1.0], ['autist', 1.0], ['tendies', 2.0], ['stonks', 1.5], ['yolo', 1.5]
    ]);

    // Negative sentiment keywords with weights
    this.negativeKeywords = new Map([
      // Strong negative (high weight)
      ['crash', -3.0], ['dump', -3.0], ['bearish', -2.5], ['selling', -2.0], ['sell', -2.0],
      ['puts', -2.0], ['short', -2.0], ['collapse', -3.0], ['plummet', -3.0], ['tank', -3.0],
      ['disaster', -3.0], ['terrible', -3.0], ['awful', -3.0], ['horrible', -3.0],
      
      // Moderate negative
      ['bad', -1.5], ['poor', -1.5], ['weak', -1.5], ['negative', -1.5], ['pessimistic', -1.5],
      ['concerned', -1.0], ['worried', -1.5], ['doubt', -1.0], ['risk', -1.0], ['risky', -1.5],
      ['dangerous', -2.0], ['volatile', -1.0], ['unstable', -1.5], ['declining', -1.5], ['down', -1.0],
      
      // Mild negative
      ['okay', -0.5], ['meh', -0.5], ['disappointing', -1.5], ['concerning', -1.0],
      ['uncertain', -1.0], ['unclear', -0.5], ['mixed', -0.5],
      
      // Finance-specific negative
      ['miss', -2.0], ['missed', -2.0], ['underperform', -2.0], ['downgrade', -2.0],
      ['loss', -1.5], ['losses', -1.5], ['debt', -1.0], ['bankruptcy', -3.0], ['layoffs', -2.0],
      ['investigation', -1.5], ['lawsuit', -1.5], ['scandal', -2.5], ['fraud', -3.0],
      
      // Meme/Reddit specific negative
      ['paper', -2.0], ['baghold', -2.0], ['bagholder', -2.0], ['rekt', -2.5], ['rug', -3.0],
      ['scam', -3.0], ['shitcoin', -2.5], ['pump and dump', -3.0]
    ]);

    // Intensifiers that modify sentiment
    this.intensifiers = new Map([
      ['very', 1.5], ['extremely', 2.0], ['super', 1.5], ['really', 1.3], ['totally', 1.5],
      ['absolutely', 1.8], ['completely', 1.8], ['highly', 1.5], ['incredibly', 2.0],
      ['massively', 2.0], ['hugely', 1.8], ['seriously', 1.3], ['definitely', 1.3],
      ['literally', 1.2], ['actually', 1.1], ['quite', 1.2], ['pretty', 1.2],
      ['somewhat', 0.8], ['slightly', 0.7], ['kinda', 0.8], ['sorta', 0.8], ['maybe', 0.6],
      ['probably', 0.9], ['possibly', 0.7], ['might', 0.6]
    ]);

    // Negation words that flip sentiment
    this.negations = new Set([
      'not', 'no', 'never', 'none', 'nothing', 'nobody', 'nowhere', 'neither', 'nor',
      'cant', "can't", 'cannot', 'shouldnt', "shouldn't", 'wouldnt', "wouldn't",
      'dont', "don't", 'doesnt', "doesn't", 'didnt', "didn't", 'wont', "won't",
      'isnt', "isn't", 'arent', "aren't", 'wasnt', "wasn't", 'werent', "weren't",
      'hasnt', "hasn't", 'havent', "haven't", 'hadnt', "hadn't"
    ]);

    // Emoji sentiment mapping
    this.emojiSentiment = new Map([
      // Positive emojis
      ['🚀', 3.0], ['🌙', 3.0], ['📈', 2.5], ['💎', 2.0], ['🔥', 2.0], ['💰', 2.0],
      ['🤑', 2.0], ['😎', 1.5], ['👍', 1.5], ['✅', 1.5], ['💪', 1.5], ['🎯', 1.5],
      ['⭐', 1.0], ['🏆', 2.0], ['🎉', 1.5], ['🔝', 1.5], ['⬆️', 1.5], ['📊', 1.0],
      
      // Negative emojis
      ['📉', -2.5], ['💸', -2.0], ['😭', -2.0], ['😢', -1.5], ['😰', -1.5], ['😱', -2.0],
      ['🤮', -2.5], ['💩', -2.0], ['👎', -1.5], ['❌', -1.5], ['⬇️', -1.5], ['🔻', -1.5],
      ['💀', -2.0], ['🩸', -2.0], ['🧸', -1.5], ['📋', -0.5]
    ]);
  }

  // Analyze sentiment of text
  analyzeSentiment(text, title = '') {
    if (!text && !title) {
      return {
        score: 0,
        confidence: 0,
        details: {
          positive_score: 0,
          negative_score: 0,
          neutral_score: 0,
          word_count: 0,
          sentiment_words: []
        }
      };
    }

    const combinedText = `${title} ${text}`.toLowerCase();
    const words = this.tokenize(combinedText);
    
    let positiveScore = 0;
    let negativeScore = 0;
    let sentimentWords = [];
    let totalWords = words.length;

    // Process emojis first
    const emojiScore = this.analyzeEmojis(combinedText);
    positiveScore += Math.max(0, emojiScore);
    negativeScore += Math.max(0, -emojiScore);

    // Process words with context
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      let wordScore = 0;
      let isNegated = false;
      let intensifier = 1.0;

      // Check for negation in previous 2 words
      for (let j = Math.max(0, i - 2); j < i; j++) {
        if (this.negations.has(words[j])) {
          isNegated = true;
          break;
        }
      }

      // Check for intensifiers in previous 2 words
      for (let j = Math.max(0, i - 2); j < i; j++) {
        if (this.intensifiers.has(words[j])) {
          intensifier = this.intensifiers.get(words[j]);
          break;
        }
      }

      // Get base sentiment score
      if (this.positiveKeywords.has(word)) {
        wordScore = this.positiveKeywords.get(word) * intensifier;
      } else if (this.negativeKeywords.has(word)) {
        wordScore = this.negativeKeywords.get(word) * intensifier;
      }

      // Apply negation
      if (isNegated && wordScore !== 0) {
        wordScore = -wordScore * 0.8; // Reduce intensity when negated
      }

      // Update scores
      if (wordScore > 0) {
        positiveScore += wordScore;
      } else if (wordScore < 0) {
        negativeScore += Math.abs(wordScore);
      }

      // Track sentiment words for analysis
      if (wordScore !== 0) {
        sentimentWords.push({
          word: word,
          score: wordScore,
          negated: isNegated,
          intensifier: intensifier
        });
      }
    }

    // Calculate final sentiment score (-100 to +100)
    const totalSentiment = positiveScore - negativeScore;
    const maxPossibleScore = totalWords * 3; // Maximum possible absolute score
    const normalizedScore = maxPossibleScore > 0 ? 
      Math.max(-100, Math.min(100, (totalSentiment / maxPossibleScore) * 100)) : 0;

    // Calculate confidence based on sentiment word density and strength
    const sentimentWordRatio = sentimentWords.length / Math.max(1, totalWords);
    const avgSentimentStrength = sentimentWords.length > 0 ?
      sentimentWords.reduce((sum, w) => sum + Math.abs(w.score), 0) / sentimentWords.length : 0;
    
    const confidence = Math.min(1, sentimentWordRatio * 2 + avgSentimentStrength / 10);

    return {
      score: Math.round(normalizedScore * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      details: {
        positive_score: Math.round(positiveScore * 100) / 100,
        negative_score: Math.round(negativeScore * 100) / 100,
        neutral_score: Math.round((totalWords - sentimentWords.length) * 100) / 100,
        word_count: totalWords,
        sentiment_words: sentimentWords,
        emoji_score: emojiScore
      }
    };
  }

  // Analyze emoji sentiment
  analyzeEmojis(text) {
    let emojiScore = 0;
    
    for (const [emoji, score] of this.emojiSentiment) {
      const count = (text.match(new RegExp(emoji, 'g')) || []).length;
      emojiScore += count * score;
    }

    return emojiScore;
  }

  // Tokenize text into words
  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation but keep spaces
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  // Batch analyze multiple texts
  batchAnalyzeSentiment(posts) {
    return posts.map(post => {
      const sentiment = this.analyzeSentiment(post.content, post.title);
      return {
        ...post,
        sentiment_score: sentiment.score,
        sentiment_confidence: sentiment.confidence,
        sentiment_details: sentiment.details
      };
    });
  }

  // Get sentiment statistics for a collection of posts
  getSentimentStats(posts) {
    if (posts.length === 0) {
      return {
        total_posts: 0,
        avg_sentiment: 0,
        sentiment_distribution: { positive: 0, negative: 0, neutral: 0 },
        confidence_stats: { avg: 0, high_confidence: 0 }
      };
    }

    const sentiments = posts.map(post => this.analyzeSentiment(post.content, post.title));
    
    const totalSentiment = sentiments.reduce((sum, s) => sum + s.score, 0);
    const avgSentiment = totalSentiment / sentiments.length;
    
    const totalConfidence = sentiments.reduce((sum, s) => sum + s.confidence, 0);
    const avgConfidence = totalConfidence / sentiments.length;
    
    const distribution = {
      positive: sentiments.filter(s => s.score > 10).length,
      negative: sentiments.filter(s => s.score < -10).length,
      neutral: sentiments.filter(s => s.score >= -10 && s.score <= 10).length
    };

    const highConfidence = sentiments.filter(s => s.confidence > 0.7).length;

    return {
      total_posts: posts.length,
      avg_sentiment: Math.round(avgSentiment * 100) / 100,
      sentiment_distribution: {
        positive: Math.round((distribution.positive / posts.length) * 100),
        negative: Math.round((distribution.negative / posts.length) * 100),
        neutral: Math.round((distribution.neutral / posts.length) * 100)
      },
      confidence_stats: {
        avg: Math.round(avgConfidence * 100) / 100,
        high_confidence: Math.round((highConfidence / posts.length) * 100)
      },
      sentiment_range: {
        min: Math.min(...sentiments.map(s => s.score)),
        max: Math.max(...sentiments.map(s => s.score))
      }
    };
  }

  // Detect sentiment for specific ticker in context
  analyzeTickerSentiment(ticker, text, title = '') {
    const combinedText = `${title} ${text}`;
    
    // Find mentions of the ticker
    const tickerRegex = new RegExp(`\\b${ticker}\\b|\\$${ticker}\\b`, 'gi');
    const mentions = [];
    let match;

    while ((match = tickerRegex.exec(combinedText)) !== null) {
      const start = Math.max(0, match.index - 100);
      const end = Math.min(combinedText.length, match.index + ticker.length + 100);
      const context = combinedText.substring(start, end);
      
      const contextSentiment = this.analyzeSentiment(context);
      mentions.push({
        position: match.index,
        context: context.trim(),
        sentiment: contextSentiment.score,
        confidence: contextSentiment.confidence
      });
    }

    if (mentions.length === 0) {
      return {
        ticker: ticker,
        overall_sentiment: 0,
        confidence: 0,
        mentions: 0,
        contexts: []
      };
    }

    // Calculate weighted average sentiment
    const totalWeight = mentions.reduce((sum, m) => sum + m.confidence, 0);
    const weightedSentiment = totalWeight > 0 ? 
      mentions.reduce((sum, m) => sum + (m.sentiment * m.confidence), 0) / totalWeight : 0;

    const avgConfidence = mentions.reduce((sum, m) => sum + m.confidence, 0) / mentions.length;

    return {
      ticker: ticker,
      overall_sentiment: Math.round(weightedSentiment * 100) / 100,
      confidence: Math.round(avgConfidence * 100) / 100,
      mentions: mentions.length,
      contexts: mentions
    };
  }

  // Add custom keywords for learning
  addCustomKeyword(word, sentiment, weight = 1.0) {
    word = word.toLowerCase();
    
    if (sentiment > 0) {
      this.positiveKeywords.set(word, weight);
      this.negativeKeywords.delete(word);
    } else if (sentiment < 0) {
      this.negativeKeywords.set(word, Math.abs(weight));
      this.positiveKeywords.delete(word);
    }
    
    return { word, sentiment, weight, added: true };
  }

  // Remove custom keyword
  removeCustomKeyword(word) {
    word = word.toLowerCase();
    const removedFromPositive = this.positiveKeywords.delete(word);
    const removedFromNegative = this.negativeKeywords.delete(word);
    
    return { word, removed: removedFromPositive || removedFromNegative };
  }

  // Get keyword statistics
  getKeywordStats() {
    return {
      positive_keywords: this.positiveKeywords.size,
      negative_keywords: this.negativeKeywords.size,
      intensifiers: this.intensifiers.size,
      negations: this.negations.size,
      emoji_mappings: this.emojiSentiment.size,
      total_vocabulary: this.positiveKeywords.size + this.negativeKeywords.size
    };
  }
}

module.exports = new SentimentAnalyzer();
