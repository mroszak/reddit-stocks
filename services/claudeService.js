const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

class ClaudeService {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.CLAUDE_API || '', // Will be empty but won't error
    });
    this.model = process.env.CLAUDE_MODEL || 'claude-3-sonnet-20240229';
    this.isConfigured = !!process.env.CLAUDE_API;
    
    // Rate limiting
    this.lastRequest = 0;
    this.minInterval = 1000; // 1 second between requests
    this.requestQueue = [];
    this.isProcessingQueue = false;
    
    // Usage tracking
    this.usage = {
      requests_today: 0,
      tokens_used: 0,
      last_reset: new Date().toISOString().split('T')[0]
    };
    
    if (!this.isConfigured) {
      console.log('⚠️  Claude API not configured - falling back to keyword-based sentiment');
    } else {
      console.log('✅ Claude API configured successfully');
    }
  }

  // Advanced sentiment analysis using Claude
  async analyzeSentiment(text, title = '', ticker = null) {
    if (!this.isConfigured) {
      console.log('Claude API not available, using fallback sentiment analysis');
      return this.getFallbackSentiment(text, title);
    }

    try {
      await this.enforceRateLimit();
      
      const prompt = this.buildSentimentPrompt(text, title, ticker);
      
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 500,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      this.updateUsage(response.usage);
      
      const result = this.parseSentimentResponse(response.content[0].text);
      
      console.log(`📊 Claude sentiment analysis: Score ${result.sentiment_score}, Confidence ${result.confidence}%`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Claude API error:', error.message);
      return this.getFallbackSentiment(text, title);
    }
  }

  // Batch sentiment analysis for multiple posts
  async batchAnalyzeSentiment(posts, maxConcurrent = 3) {
    if (!this.isConfigured) {
      console.log('Claude API not available, using fallback for batch analysis');
      return posts.map(post => ({
        ...post,
        claude_sentiment: this.getFallbackSentiment(post.content, post.title)
      }));
    }

    console.log(`🔄 Starting Claude batch analysis for ${posts.length} posts`);
    
    const results = [];
    const chunks = this.chunkArray(posts, maxConcurrent);
    
    for (const chunk of chunks) {
      const promises = chunk.map(async (post) => {
        const sentiment = await this.analyzeSentiment(
          post.content, 
          post.title, 
          post.tickers ? post.tickers[0] : null
        );
        return {
          ...post,
          claude_sentiment: sentiment
        };
      });
      
      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults);
      
      // Wait between chunks to respect rate limits
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await this.delay(2000);
      }
    }
    
    console.log(`✅ Claude batch analysis complete: ${results.length} posts processed`);
    return results;
  }

  // Advanced post quality assessment
  async assessPostQuality(post) {
    if (!this.isConfigured) {
      return this.getFallbackQualityScore(post);
    }

    try {
      await this.enforceRateLimit();
      
      const prompt = this.buildQualityPrompt(post);
      
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 300,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      this.updateUsage(response.usage);
      
      const result = this.parseQualityResponse(response.content[0].text);
      
      console.log(`🎯 Claude quality assessment: Score ${result.quality_score}, Type: ${result.content_type}`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Claude quality assessment error:', error.message);
      return this.getFallbackQualityScore(post);
    }
  }

  // Detect manipulation or coordinated posting
  async detectManipulation(posts) {
    if (!this.isConfigured || posts.length < 2) {
      return { is_manipulation: false, confidence: 0, patterns: [] };
    }

    try {
      await this.enforceRateLimit();
      
      const prompt = this.buildManipulationPrompt(posts);
      
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 400,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      this.updateUsage(response.usage);
      
      const result = this.parseManipulationResponse(response.content[0].text);
      
      if (result.is_manipulation) {
        console.log(`🚨 Claude detected potential manipulation: ${result.confidence}% confidence`);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Claude manipulation detection error:', error.message);
      return { is_manipulation: false, confidence: 0, patterns: [] };
    }
  }

  // Summarize complex DD (Due Diligence) posts
  async summarizePost(post, maxLength = 200) {
    if (!this.isConfigured) {
      return post.content.substring(0, maxLength) + '...';
    }

    try {
      await this.enforceRateLimit();
      
      const prompt = this.buildSummaryPrompt(post, maxLength);
      
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: Math.min(500, maxLength * 2),
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      this.updateUsage(response.usage);
      
      const summary = response.content[0].text.trim();
      
      console.log(`📝 Claude summary generated: ${summary.length} characters`);
      
      return summary;
      
    } catch (error) {
      console.error('❌ Claude summarization error:', error.message);
      return post.content.substring(0, maxLength) + '...';
    }
  }

  // Build sentiment analysis prompt
  buildSentimentPrompt(text, title, ticker) {
    return `Analyze the sentiment of this Reddit post about ${ticker || 'stocks'}:

Title: "${title}"
Content: "${text}"

Please provide a JSON response with:
1. sentiment_score: number from -100 (very bearish) to +100 (very bullish)
2. confidence: number from 0-100 (how confident you are in this assessment)
3. reasoning: brief explanation of your analysis
4. key_factors: array of important phrases that influenced the score
5. bullish_indicators: array of positive signals
6. bearish_indicators: array of negative signals
7. sarcasm_detected: boolean if sarcasm/irony was detected
8. manipulation_risk: number from 0-100 (likelihood this is pump/dump content)

Focus on:
- Financial terminology and context
- Reddit-specific language and memes
- Sarcasm and irony detection
- Pump and dump indicators
- Quality of analysis vs emotional reactions
- User intent (genuine analysis vs manipulation)

Return only valid JSON.`;
  }

  // Build quality assessment prompt
  buildQualityPrompt(post) {
    return `Assess the quality of this Reddit post for stock analysis:

Title: "${post.title}"
Content: "${post.content}"
Upvotes: ${post.upvotes || 0}
Comments: ${post.comments || 0}
Author: ${post.author || 'unknown'}

Please provide a JSON response with:
1. quality_score: number from 0-100 (overall post quality)
2. content_type: string ("DD", "meme", "news", "question", "discussion", "spam")
3. analysis_depth: number from 0-100 (depth of financial analysis)
4. credibility: number from 0-100 (how credible the information seems)
5. educational_value: number from 0-100 (how much someone could learn)
6. spam_likelihood: number from 0-100 (likelihood this is spam/manipulation)
7. key_strengths: array of positive aspects
8. key_weaknesses: array of areas for improvement

Consider:
- Factual accuracy and sources
- Depth of financial analysis
- Clear reasoning and logic
- Balanced perspective
- Educational value
- Originality vs copy-paste content

Return only valid JSON.`;
  }

  // Build manipulation detection prompt
  buildManipulationPrompt(posts) {
    const postSummaries = posts.slice(0, 10).map((post, i) => 
      `Post ${i+1}: "${post.title}" by ${post.author} (${post.upvotes} upvotes)`
    ).join('\n');

    return `Analyze these Reddit posts for potential coordination or manipulation:

${postSummaries}

Please provide a JSON response with:
1. is_manipulation: boolean (likely coordinated effort)
2. confidence: number from 0-100 (confidence in assessment)
3. patterns: array of suspicious patterns detected
4. risk_level: string ("low", "medium", "high", "critical")
5. recommendations: array of suggested actions

Look for:
- Similar posting patterns or timing
- Repetitive language or phrases
- Coordinated sentiment direction
- Unusual account behavior
- Pump and dump indicators
- Astroturfing patterns

Return only valid JSON.`;
  }

  // Build summarization prompt
  buildSummaryPrompt(post, maxLength) {
    return `Summarize this Reddit post in ${maxLength} characters or less:

Title: "${post.title}"
Content: "${post.content}"

Focus on:
- Key financial points and analysis
- Main investment thesis
- Important data or metrics
- Notable risks or opportunities

Provide a clear, concise summary that captures the essential information for stock investors.`;
  }

  // Parse Claude sentiment response
  parseSentimentResponse(responseText) {
    try {
      const parsed = JSON.parse(responseText);
      return {
        sentiment_score: Math.max(-100, Math.min(100, parsed.sentiment_score || 0)),
        confidence: Math.max(0, Math.min(100, parsed.confidence || 0)),
        reasoning: parsed.reasoning || '',
        key_factors: Array.isArray(parsed.key_factors) ? parsed.key_factors : [],
        bullish_indicators: Array.isArray(parsed.bullish_indicators) ? parsed.bullish_indicators : [],
        bearish_indicators: Array.isArray(parsed.bearish_indicators) ? parsed.bearish_indicators : [],
        sarcasm_detected: !!parsed.sarcasm_detected,
        manipulation_risk: Math.max(0, Math.min(100, parsed.manipulation_risk || 0)),
        analysis_type: 'claude'
      };
    } catch (error) {
      console.error('❌ Failed to parse Claude sentiment response:', error.message);
      return this.getFallbackSentiment('', '');
    }
  }

  // Parse Claude quality response
  parseQualityResponse(responseText) {
    try {
      const parsed = JSON.parse(responseText);
      return {
        quality_score: Math.max(0, Math.min(100, parsed.quality_score || 0)),
        content_type: parsed.content_type || 'discussion',
        analysis_depth: Math.max(0, Math.min(100, parsed.analysis_depth || 0)),
        credibility: Math.max(0, Math.min(100, parsed.credibility || 0)),
        educational_value: Math.max(0, Math.min(100, parsed.educational_value || 0)),
        spam_likelihood: Math.max(0, Math.min(100, parsed.spam_likelihood || 0)),
        key_strengths: Array.isArray(parsed.key_strengths) ? parsed.key_strengths : [],
        key_weaknesses: Array.isArray(parsed.key_weaknesses) ? parsed.key_weaknesses : [],
        analysis_type: 'claude'
      };
    } catch (error) {
      console.error('❌ Failed to parse Claude quality response:', error.message);
      return this.getFallbackQualityScore({});
    }
  }

  // Parse Claude manipulation response
  parseManipulationResponse(responseText) {
    try {
      const parsed = JSON.parse(responseText);
      return {
        is_manipulation: !!parsed.is_manipulation,
        confidence: Math.max(0, Math.min(100, parsed.confidence || 0)),
        patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
        risk_level: parsed.risk_level || 'low',
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : []
      };
    } catch (error) {
      console.error('❌ Failed to parse Claude manipulation response:', error.message);
      return { is_manipulation: false, confidence: 0, patterns: [] };
    }
  }

  // Fallback sentiment analysis using existing keyword-based system
  getFallbackSentiment(text, title) {
    const sentimentAnalyzer = require('../utils/sentimentAnalyzer');
    const result = sentimentAnalyzer.analyzeSentiment(text, title);
    
    return {
      sentiment_score: result.score,
      confidence: result.confidence * 100,
      reasoning: 'Keyword-based analysis (Claude unavailable)',
      key_factors: result.details.sentiment_words.map(w => w.word),
      bullish_indicators: result.details.sentiment_words.filter(w => w.score > 0).map(w => w.word),
      bearish_indicators: result.details.sentiment_words.filter(w => w.score < 0).map(w => w.word),
      sarcasm_detected: false,
      manipulation_risk: 0,
      analysis_type: 'keyword'
    };
  }

  // Fallback quality score calculation
  getFallbackQualityScore(post) {
    const upvotes = post.upvotes || 0;
    const comments = post.comments || 0;
    const titleLength = (post.title || '').length;
    const contentLength = (post.content || '').length;
    
    // Simple heuristic quality score
    const engagementScore = Math.min(50, (upvotes * 0.1) + (comments * 0.5));
    const lengthScore = Math.min(25, contentLength / 20);
    const titleScore = Math.min(25, titleLength / 4);
    
    const qualityScore = engagementScore + lengthScore + titleScore;
    
    return {
      quality_score: Math.round(qualityScore),
      content_type: contentLength > 500 ? 'DD' : 'discussion',
      analysis_depth: Math.min(100, contentLength / 10),
      credibility: 50, // Neutral default
      educational_value: Math.min(100, contentLength / 15),
      spam_likelihood: upvotes < 0 ? 80 : 20,
      key_strengths: [],
      key_weaknesses: [],
      analysis_type: 'heuristic'
    };
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
  updateUsage(usage) {
    const today = new Date().toISOString().split('T')[0];
    
    if (this.usage.last_reset !== today) {
      this.usage.requests_today = 0;
      this.usage.tokens_used = 0;
      this.usage.last_reset = today;
    }
    
    this.usage.requests_today++;
    if (usage && usage.input_tokens) {
      this.usage.tokens_used += usage.input_tokens + (usage.output_tokens || 0);
    }
  }

  // Get usage statistics
  getUsageStats() {
    return {
      ...this.usage,
      is_configured: this.isConfigured,
      model: this.model,
      rate_limit_interval: this.minInterval
    };
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

module.exports = new ClaudeService();
