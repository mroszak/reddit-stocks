# Render.com Deployment Guide

This guide will help you deploy your Reddit Stocks Sentiment Tracker to Render.com.

## Prerequisites

1. A Render.com account (free tier available)
2. Your project pushed to a GitHub repository
3. MongoDB Atlas account (for managed MongoDB) or use Render's managed database

## Step 1: Prepare Your Repository

1. Ensure all your code is committed and pushed to GitHub
2. The `render.yaml` file has been created in your project root
3. Package.json has been updated with the proper build scripts

## Step 2: Create a Web Service on Render

1. **Log into Render.com**
2. **Click "New" → "Web Service"**
3. **Connect your GitHub repository**
4. **Configure the service:**
   - **Name**: `reddit-stocks-tracker`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`

## Step 3: Set Environment Variables

In the Render dashboard, add these environment variables:

### Required Environment Variables

```bash
# Node Environment
NODE_ENV=production
PORT=10000

# Database
MONGODB_URI=your_mongodb_connection_string

# Reddit API Credentials
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
REDDIT_USERNAME=your_reddit_username
REDDIT_PASSWORD=your_reddit_password
REDDIT_USER_AGENT=your_app_name/1.0.0

# External API Keys
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
ANTHROPIC_API_KEY=your_anthropic_api_key
FRED_API_KEY=your_fred_api_key

# Optional: Frontend URL (if different from default)
FRONTEND_URL=https://your-app-name.onrender.com
```

### Where to Get API Keys

1. **Reddit API**: 
   - Go to https://www.reddit.com/prefs/apps
   - Create a new app (script type)
   - Use the client ID and secret

2. **Alpha Vantage**: 
   - Free tier available at https://www.alphavantage.co/support/#api-key

3. **Anthropic (Claude)**: 
   - Get API key from https://console.anthropic.com/

4. **FRED API**: 
   - Free tier available at https://fred.stlouisfed.org/docs/api/api_key.html

## Step 4: Database Setup Options

### Option A: MongoDB Atlas (Recommended)

1. **Create a MongoDB Atlas account**: https://www.mongodb.com/atlas
2. **Create a new cluster** (free tier available)
3. **Create a database user**
4. **Whitelist all IP addresses** (0.0.0.0/0) for Render deployment
5. **Get your connection string** and set it as `MONGODB_URI`

### Option B: Render Managed MongoDB

1. In Render dashboard, create a new MongoDB database
2. Use the connection string provided by Render
3. Uncomment the database section in `render.yaml`

## Step 5: Deploy

1. **Click "Create Web Service"** in Render
2. **Wait for the build to complete** (first build may take 5-10 minutes)
3. **Check the logs** for any errors
4. **Visit your app** at the provided URL

## Step 6: Post-Deployment Setup

1. **Test the health check**: Visit `https://your-app.onrender.com/api/health`
2. **Initialize the database**: The app will auto-initialize on first run
3. **Monitor logs** for any issues

## Common Issues and Solutions

### Build Failures

- **Node version issues**: Add `NODE_VERSION=18` to environment variables
- **Memory issues**: Upgrade to a paid plan if needed
- **Dependency issues**: Check that all dependencies are in package.json

### Runtime Issues

- **Database connection**: Verify MongoDB URI is correct
- **API keys**: Ensure all required environment variables are set
- **CORS errors**: Verify FRONTEND_URL is set correctly

### Performance

- **Free tier limitations**: 
  - Service spins down after 15 minutes of inactivity
  - 512MB RAM limit
  - Consider upgrading for production use

## Render.yaml Configuration

The `render.yaml` file in your project root contains:

- Service configuration for automatic deployments
- Environment variable definitions
- Build and deployment settings
- Health check configuration

## Monitoring Your Deployment

1. **Render Dashboard**: Monitor service health, logs, and metrics
2. **Health Check Endpoint**: `/api/health` provides service status
3. **Application Logs**: Available in Render dashboard

## Scaling and Upgrades

- **Free Tier**: Good for development/testing
- **Starter Plan ($7/month)**: Better for production use
- **Professional Plans**: For high-traffic applications

## Environment-Specific Notes

- **Production builds**: React app is built and served statically
- **Database connections**: MongoDB connection pooling is handled automatically
- **Socket.IO**: WebSocket connections work on Render
- **Cron jobs**: Scheduled tasks will run as configured

## Updating Your Deployment

1. **Push changes** to your GitHub repository
2. **Render auto-deploys** from the main branch
3. **Monitor logs** during deployment
4. **Test functionality** after deployment completes

## Support and Troubleshooting

- **Render Documentation**: https://render.com/docs
- **Application Logs**: Check Render dashboard for detailed error logs
- **Health Check**: Use `/api/health` endpoint to verify service status

## Security Notes

- All environment variables are encrypted at rest
- Use strong, unique API keys
- Regularly rotate credentials
- Monitor access logs

Your Reddit Stocks Sentiment Tracker should now be successfully deployed on Render.com!
