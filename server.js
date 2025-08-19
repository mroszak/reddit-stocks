const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Import route modules
const redditRoutes = require('./routes/reddit');
const stockRoutes = require('./routes/stocks');
const subredditRoutes = require('./routes/subreddits');
const analysisRoutes = require('./routes/analysis');

// Import services
const startupManager = require('./scripts/startup');
const dataProcessor = require('./services/dataProcessor');
const monitoringService = require('./services/monitoringService');

// Initialize Express app and HTTP server
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ["https://yourdomain.com"] 
      : ["http://localhost:3000"],
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reddit-stocks-tracker';

mongoose.connect(MONGODB_URI)
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// API Routes
app.use('/api/reddit', redditRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/subreddits', subredditRoutes);
app.use('/api/analysis', analysisRoutes);

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  // Join specific rooms for targeted updates
  socket.on('joinStock', (ticker) => {
    socket.join(`stock:${ticker}`);
    console.log(`📈 Client ${socket.id} joined stock room: ${ticker}`);
  });

  socket.on('leaveStock', (ticker) => {
    socket.leave(`stock:${ticker}`);
    console.log(`📉 Client ${socket.id} left stock room: ${ticker}`);
  });

  socket.on('joinSubreddit', (subreddit) => {
    socket.join(`subreddit:${subreddit}`);
    console.log(`👥 Client ${socket.id} joined subreddit room: ${subreddit}`);
  });

  socket.on('leaveSubreddit', (subreddit) => {
    socket.leave(`subreddit:${subreddit}`);
    console.log(`👋 Client ${socket.id} left subreddit room: ${subreddit}`);
  });

  // Request handlers for real-time updates
  socket.on('requestStockUpdates', (ticker) => {
    console.log(`📊 Client ${socket.id} requested stock updates for: ${ticker}`);
    // Add logic to send current stock data
  });

  socket.on('requestTrendingUpdates', () => {
    console.log(`🔥 Client ${socket.id} requested trending updates`);
    // Add logic to send current trending data
  });

  socket.on('requestProcessingUpdates', () => {
    console.log(`⚙️ Client ${socket.id} requested processing updates`);
    // Add logic to send current processing status
  });

  socket.on('disconnect', (reason) => {
    console.log(`🔌 Client disconnected: ${socket.id}, reason: ${reason}`);
  });
});

// Make io available to other modules
app.set('io', io);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const health = await startupManager.healthCheck();
    res.json({ 
      status: 'OK', 
      phase: 'Phase 3 - Advanced Analysis (COMPLETE)',
      features: {
        'Phase 1': 'Core Data Pipeline (COMPLETE)',
        'Phase 2': 'Subreddit Management System (COMPLETE)', 
        'Phase 3': 'Advanced Analysis (COMPLETE)'
      },
      new_capabilities: [
        'Claude AI sentiment analysis',
        'News correlation analysis',
        'Economic context integration',
        'Enhanced user reputation scoring',
        'Comprehensive confidence scoring',
        'Advanced manipulation detection'
      ],
      ...health
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Serve static files from React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Setup scheduled jobs for data processing
if (process.env.NODE_ENV !== 'test') {
  // Clean up old data daily at 2 AM (monitoring service handles data processing)
  cron.schedule('0 2 * * *', async () => {
    console.log('🧹 Daily cleanup started...');
    try {
      await dataProcessor.cleanupOldData({ daysToKeep: 30, dryRun: false });
      console.log('✅ Daily cleanup completed');
    } catch (error) {
      console.error('❌ Daily cleanup failed:', error.message);
    }
  });
}

// Start the server with initialization
async function startServer() {
  try {
    // Run startup initialization
    console.log('🔄 Initializing Reddit Stocks Sentiment Tracker...');
    const startupResult = await startupManager.startup();
    
    if (!startupResult.success) {
      throw new Error(startupResult.error);
    }

    // Start monitoring service for Phase 2
    if (process.env.NODE_ENV !== 'test') {
      try {
        console.log('🚀 Starting automated monitoring service (Phase 2)...');
        const started = await monitoringService.startMonitoring(15); // 15 minute intervals
        if (started) {
          console.log('✅ Automated monitoring started with 15-minute intervals');
        } else {
          console.log('⚠️ Monitoring service was already running');
        }
      } catch (error) {
        console.error('❌ Failed to start monitoring service:', error.message);
      }
    }

    // Start the HTTP server with Socket.IO
    server.listen(PORT, () => {
      console.log('\n' + '='.repeat(60));
      console.log(`🚀 Reddit Stocks Sentiment Tracker - Phase 2`);
      console.log(`📊 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`📈 API Documentation: http://localhost:${PORT}/api/`);
      console.log(`⚙️ Monitoring Dashboard: http://localhost:${PORT}/api/subreddits/monitoring/dashboard`);
      console.log('='.repeat(60));
      
      if (process.env.NODE_ENV !== 'test') {
        console.log('⏰ Automated services active:');
        console.log('   - Monitoring Service: Dynamic subreddit processing');
        console.log('   - Cross-validation: Signal verification across communities');
        console.log('   - Performance Metrics: Real-time accuracy tracking');
        console.log('   - Daily Cleanup: 2 AM EST');
      }
    });

  } catch (error) {
    console.error('❌ Server startup failed:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Stopping monitoring service...');
  monitoringService.stopMonitoring();
  await startupManager.shutdown();
});

process.on('SIGTERM', async () => {
  console.log('🛑 Stopping monitoring service...');
  monitoringService.stopMonitoring();
  await startupManager.shutdown();
});

// Start the server
startServer();

module.exports = app;
