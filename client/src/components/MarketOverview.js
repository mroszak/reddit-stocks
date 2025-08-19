import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  LinearProgress,
  Alert,
  IconButton,
  Tooltip,
  Divider,
  Paper
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Speed as SpeedIcon,
  Psychology as PsychologyIcon,
  Groups as GroupsIcon,
  Assessment as AssessmentIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Timer as TimerIcon
} from '@mui/icons-material';

import { ApiService } from '../services/ApiService';
import { WebSocketService } from '../services/WebSocketService';
import ConfidenceIndicator from './ConfidenceIndicator';

function MarketOverview({ systemHealth, processingStats, monitoringStatus, onStockSelect }) {
  const [topStocks, setTopStocks] = useState([]);
  const [economicData, setEconomicData] = useState(null);
  const [marketNews, setMarketNews] = useState([]);
  const [subredditStats, setSubredditStats] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    loadOverviewData();
    setupWebSocketSubscriptions();

    const interval = setInterval(loadOverviewData, 300000); // Refresh every 5 minutes

    return () => {
      clearInterval(interval);
      cleanupWebSocketSubscriptions();
    };
  }, []);

  const loadOverviewData = async () => {
    try {
      const [stocks, economic, news, subreddits] = await Promise.allSettled([
        ApiService.getEnhancedTrendingStocks({ limit: 10, minConfidence: 60 }),
        ApiService.getEconomicIndicators(),
        ApiService.getMarketNews({ limit: 5 }),
        ApiService.getPerformanceRanking({ limit: 8 })
      ]);

      if (stocks.status === 'fulfilled') {
        setTopStocks(stocks.value.stocks || stocks.value || []);
      }

      if (economic.status === 'fulfilled') {
        setEconomicData(economic.value);
      }

      if (news.status === 'fulfilled') {
        setMarketNews(news.value.articles || news.value || []);
      }

      if (subreddits.status === 'fulfilled') {
        setSubredditStats(subreddits.value.subreddits || subreddits.value || []);
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load overview data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupWebSocketSubscriptions = () => {
    WebSocketService.subscribe('alertUpdate', (data) => {
      setAlerts(prev => [data, ...prev.slice(0, 4)]); // Keep last 5 alerts
    });

    WebSocketService.subscribe('trendingUpdate', (data) => {
      if (data.stocks) {
        setTopStocks(data.stocks.slice(0, 10));
      }
    });
  };

  const cleanupWebSocketSubscriptions = () => {
    WebSocketService.unsubscribe('alertUpdate');
    WebSocketService.unsubscribe('trendingUpdate');
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'running':
      case 'active':
        return <CheckCircleIcon color="success" />;
      case 'warning':
      case 'limited':
        return <WarningIcon color="warning" />;
      case 'error':
      case 'stopped':
      case 'inactive':
        return <ErrorIcon color="error" />;
      default:
        return <TimerIcon color="action" />;
    }
  };

  const getMarketSentiment = () => {
    if (!topStocks.length) return { sentiment: 0, label: 'Unknown', color: 'default' };
    
    const avgSentiment = topStocks.reduce((sum, stock) => 
      sum + (stock.sentiment || stock.sentimentScore || 0), 0
    ) / topStocks.length;

    if (avgSentiment > 30) return { sentiment: avgSentiment, label: 'Very Bullish', color: 'success' };
    if (avgSentiment > 10) return { sentiment: avgSentiment, label: 'Bullish', color: 'info' };
    if (avgSentiment > -10) return { sentiment: avgSentiment, label: 'Neutral', color: 'warning' };
    if (avgSentiment > -30) return { sentiment: avgSentiment, label: 'Bearish', color: 'error' };
    return { sentiment: avgSentiment, label: 'Very Bearish', color: 'error' };
  };

  const marketSentiment = getMarketSentiment();

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num?.toString() || '0';
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          📊 Market Overview
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </Typography>
          <Tooltip title="Refresh Data">
            <span>
              <IconButton onClick={loadOverviewData} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* System Status */}
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🔧 System Status
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Health</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getStatusIcon(systemHealth?.status)}
                    <Typography variant="body2">{systemHealth?.status || 'Unknown'}</Typography>
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Monitoring</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getStatusIcon(monitoringStatus?.status)}
                    <Typography variant="body2">{monitoringStatus?.status || 'Unknown'}</Typography>
                  </Box>
                </Box>

                <Divider />

                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Posts Processed</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {formatNumber(processingStats?.processing?.posts_processed)}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Unique Tickers</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {processingStats?.database?.unique_tickers || 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Market Sentiment */}
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📈 Market Sentiment
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <ConfidenceIndicator
                  value={Math.abs(marketSentiment.sentiment)}
                  size="large"
                  showLabel={true}
                  detailed={true}
                />
                <Chip
                  label={marketSentiment.label}
                  color={marketSentiment.color}
                  icon={marketSentiment.sentiment > 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
                />
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  Based on {topStocks.length} trending stocks
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Economic Indicators */}
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🏛️ Economic Context
              </Typography>
              {economicData ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {economicData.indicators?.slice(0, 4).map((indicator, index) => (
                    <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {indicator.name}
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {indicator.value} {indicator.unit}
                      </Typography>
                    </Box>
                  ))}
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ textAlign: 'center' }}>
                    <Chip
                      label={economicData.sentiment || 'Neutral'}
                      color={economicData.sentiment === 'Favorable' ? 'success' : 'warning'}
                      size="small"
                    />
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Economic data unavailable
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Active Alerts */}
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🚨 Recent Alerts
              </Typography>
              {alerts.length > 0 ? (
                <List dense>
                  {alerts.slice(0, 3).map((alert, index) => (
                    <ListItem key={index} sx={{ px: 0 }}>
                      <ListItemAvatar>
                        <Avatar sx={{ width: 24, height: 24, bgcolor: 'warning.main' }}>
                          <WarningIcon fontSize="small" />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography variant="body2">
                            {alert.ticker || 'Market'}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {alert.message || alert.type}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No recent alerts
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Top Trending Stocks */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🔥 Top Trending Stocks
              </Typography>
              {topStocks.length > 0 ? (
                <List>
                  {topStocks.slice(0, 5).map((stock, index) => (
                    <ListItem
                      key={stock.ticker}
                      onClick={() => onStockSelect && onStockSelect(stock.ticker)}
                      sx={{ 
                        borderRadius: 1, 
                        mb: 1,
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          {stock.ticker?.charAt(0)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle2" fontWeight="bold">
                              {stock.ticker}
                            </Typography>
                            <Chip
                              label={`${(stock.trendingScore || stock.score || 0).toFixed(0)}`}
                              size="small"
                              color="primary"
                            />
                          </Box>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <SpeedIcon fontSize="small" color="action" />
                              <Typography variant="caption">
                                {formatNumber(stock.mentions || stock.mentionCount || 0)}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <PsychologyIcon fontSize="small" color="action" />
                              <Typography variant="caption">
                                {(stock.sentiment || stock.sentimentScore || 0).toFixed(0)}%
                              </Typography>
                            </Box>
                            <ConfidenceIndicator
                              value={stock.confidence || stock.confidenceScore || 0}
                              size="small"
                              variant="chip"
                            />
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    No trending stocks available
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Subreddit Performance */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📊 Subreddit Performance
              </Typography>
              {subredditStats.length > 0 ? (
                <List>
                  {subredditStats.slice(0, 5).map((subreddit, index) => (
                    <ListItem key={subreddit.name} sx={{ px: 0 }}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'secondary.main' }}>
                          <GroupsIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="subtitle2">
                              r/{subreddit.name}
                            </Typography>
                            <Chip
                              label={`${(subreddit.accuracy_rate || 0).toFixed(0)}%`}
                              color={subreddit.accuracy_rate > 70 ? 'success' : 'warning'}
                              size="small"
                            />
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={subreddit.accuracy_rate || 0}
                              color={subreddit.accuracy_rate > 70 ? 'success' : 'warning'}
                              sx={{ height: 4, borderRadius: 2 }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                              {formatNumber(subreddit.total_posts_processed || 0)} posts processed
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    No subreddit data available
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {loading && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress />
        </Box>
      )}
    </Box>
  );
}

export default MarketOverview;
