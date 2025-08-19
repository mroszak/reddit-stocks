import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Chip,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  LinearProgress,
  Stack,
  Divider,
  Skeleton,
  Fade,
  Zoom,
  useTheme,
  alpha
} from '@mui/material';
import {
  TrendingUp as TrendingIcon,
  TrendingDown as TrendingDownIcon,
  Speed as SpeedIcon,
  Psychology as PsychologyIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  ShowChart as ShowChartIcon,
  Timeline as TimelineIcon,
  Insights as InsightsIcon,
  Pulse as PulseIcon,
  AutoGraph as AutoGraphIcon
} from '@mui/icons-material';

import { ApiService } from '../services/ApiService';
import { WebSocketService } from '../services/WebSocketService';
import TrendingStocks from './TrendingStocks';
import MarketOverview from './MarketOverview';
import SystemStatus from './SystemStatus';
import ConfidenceIndicator from './ConfidenceIndicator';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`dashboard-tabpanel-${index}`}
      aria-labelledby={`dashboard-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function Dashboard({ activeTab = 'overview', onStockSelect }) {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);
  const [processingStats, setProcessingStats] = useState(null);
  const [monitoringStatus, setMonitoringStatus] = useState(null);
  const [trendingData, setTrendingData] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(null);

  const tabs = [
    { label: 'Market Overview', value: 'overview', icon: <SpeedIcon />, color: 'primary' },
    { label: 'Trending Now', value: 'trending', icon: <TrendingIcon />, color: 'success' },
    { label: 'AI Validated', value: 'validated', icon: <PsychologyIcon />, color: 'info' },
    { label: 'Deep Analysis', value: 'analysis', icon: <InsightsIcon />, color: 'warning' }
  ];

  useEffect(() => {
    // Set initial tab based on prop
    const tabIndex = tabs.findIndex(tab => tab.value === activeTab);
    if (tabIndex !== -1) {
      setTabValue(tabIndex);
    }
  }, [activeTab]);

  useEffect(() => {
    loadInitialData();
    setupWebSocketSubscriptions();
    
    if (autoRefresh) {
      startAutoRefresh();
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      cleanupWebSocketSubscriptions();
    };
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [health, stats, monitoring, trending] = await Promise.allSettled([
        ApiService.getSystemHealth(),
        ApiService.getProcessingStats(),
        ApiService.getMonitoringStatus(),
        ApiService.getEnhancedTrendingStocks({ limit: 20 })
      ]);

      if (health.status === 'fulfilled') setSystemHealth(health.value);
      if (stats.status === 'fulfilled') setProcessingStats(stats.value);
      if (monitoring.status === 'fulfilled') setMonitoringStatus(monitoring.value);
      if (trending.status === 'fulfilled') setTrendingData(trending.value);

      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const setupWebSocketSubscriptions = () => {
    WebSocketService.subscribe('systemHealth', (data) => {
      setSystemHealth(data);
    });

    WebSocketService.subscribe('processingUpdate', (data) => {
      setProcessingStats(data);
      setLastUpdate(new Date());
    });

    WebSocketService.subscribe('trendingUpdate', (data) => {
      setTrendingData(data);
      setLastUpdate(new Date());
    });

    WebSocketService.subscribe('connection', (data) => {
      if (data.status === 'connected') {
        WebSocketService.requestTrendingUpdates();
        WebSocketService.requestProcessingUpdates();
      }
    });
  };

  const cleanupWebSocketSubscriptions = () => {
    WebSocketService.unsubscribe('systemHealth');
    WebSocketService.unsubscribe('processingUpdate');
    WebSocketService.unsubscribe('trendingUpdate');
    WebSocketService.unsubscribe('connection');
  };

  const startAutoRefresh = () => {
    const interval = setInterval(() => {
      loadInitialData();
    }, 60000); // Refresh every minute
    setRefreshInterval(interval);
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleRefresh = () => {
    loadInitialData();
  };

  const handleStockSelect = (ticker) => {
    if (onStockSelect) {
      onStockSelect(ticker);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'running':
      case 'active':
        return 'success';
      case 'warning':
      case 'limited':
        return 'warning';
      case 'error':
      case 'stopped':
      case 'inactive':
        return 'error';
      default:
        return 'default';
    }
  };

  // Helper function to create metric cards
  const MetricCard = ({ title, value, subtitle, icon, color = 'primary', trend, loading: cardLoading }) => (
    <Zoom in={!cardLoading} timeout={300}>
      <Card 
        variant="metric"
        sx={{ 
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: `linear-gradient(90deg, ${theme.palette[color].main}, ${theme.palette[color].light})`,
          }
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette[color].main, 0.1),
                  color: `${color}.main`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {icon}
              </Box>
              {trend && (
                <Chip
                  label={trend}
                  size="small"
                  color={trend.startsWith('+') ? 'success' : 'error'}
                  sx={{ fontWeight: 600 }}
                />
              )}
            </Stack>
            
            <Box>
              <Typography variant="h3" fontWeight={700} color="text.primary">
                {cardLoading ? <Skeleton width={80} /> : value}
              </Typography>
              <Typography variant="overline" color="text.secondary" sx={{ mt: 1 }}>
                {title}
              </Typography>
              {subtitle && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Zoom>
  );

  if (loading && !trendingData) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        height: '60vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress size={60} thickness={4} />
        <Typography variant="body2" color="text.secondary">
          Loading dashboard data...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: '100%' }}>
      {/* Hero Header */}
      <Fade in timeout={600}>
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Box>
              <Typography 
                variant="h2" 
                fontWeight={700} 
                sx={{ 
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 1
                }}
              >
                Market Intelligence
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Real-time sentiment analysis from Reddit communities
              </Typography>
            </Box>
            
            <Stack direction="row" alignItems="center" spacing={2}>
              <Stack alignItems="flex-end">
                <Typography variant="caption" color="text.secondary">
                  Last updated
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {lastUpdate.toLocaleTimeString()}
                </Typography>
              </Stack>
              <Divider orientation="vertical" flexItem />
              <Tooltip title="Refresh Data">
                <IconButton 
                  onClick={handleRefresh} 
                  disabled={loading}
                  sx={{
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.2),
                    }
                  }}
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          {error && (
            <Fade in timeout={300}>
              <Alert 
                severity="error" 
                sx={{ mb: 3, borderRadius: 2 }} 
                onClose={() => setError(null)}
              >
                {error}
              </Alert>
            </Fade>
          )}
        </Box>
      </Fade>

      {/* Hero Metrics */}
      <Fade in timeout={800}>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid xs={12} sm={6} lg={3}>
            <MetricCard
              title="System Status"
              value={systemHealth?.status || 'Unknown'}
              subtitle="Core systems operational"
              icon={<SpeedIcon />}
              color={getStatusColor(systemHealth?.status) === 'success' ? 'success' : 'error'}
              loading={loading}
            />
          </Grid>
          
          <Grid xs={12} sm={6} lg={3}>
            <MetricCard
              title="Posts Analyzed"
              value={processingStats?.processing?.posts_processed?.toLocaleString() || '0'}
              subtitle="Reddit posts processed today"
              icon={<AutoGraphIcon />}
              color="primary"
              trend="+12.3%"
              loading={loading}
            />
          </Grid>
          
          <Grid xs={12} sm={6} lg={3}>
            <MetricCard
              title="Active Tickers"
              value={processingStats?.database?.unique_tickers?.toLocaleString() || '0'}
              subtitle="Stocks being tracked"
              icon={<ShowChartIcon />}
              color="info"
              trend="+5.7%"
              loading={loading}
            />
          </Grid>
          
          <Grid xs={12} sm={6} lg={3}>
            <MetricCard
              title="AI Confidence"
              value="87.2%"
              subtitle="Average prediction accuracy"
              icon={<PsychologyIcon />}
              color="warning"
              trend="+2.1%"
              loading={loading}
            />
          </Grid>
        </Grid>
      </Fade>

      {/* Enhanced Tabs Section */}
      <Fade in timeout={1000}>
        <Paper 
          variant="trading"
          sx={{ 
            width: '100%',
            overflow: 'hidden',
            borderRadius: 3
          }}
        >
          <Box sx={{ 
            borderBottom: 1, 
            borderColor: 'divider',
            bgcolor: alpha(theme.palette.background.paper, 0.8),
            backdropFilter: 'blur(20px)'
          }}>
            <Tabs 
              value={tabValue} 
              onChange={handleTabChange} 
              aria-label="dashboard tabs"
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                px: 2,
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: '1rem',
                  minHeight: 72,
                  py: 2,
                  px: 3,
                  borderRadius: 2,
                  margin: '8px 4px',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                  },
                  '&.Mui-selected': {
                    bgcolor: alpha(theme.palette.primary.main, 0.12),
                    color: 'primary.main',
                    fontWeight: 600,
                  }
                },
                '& .MuiTabs-indicator': {
                  height: 3,
                  borderRadius: '3px 3px 0 0',
                  background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`
                }
              }}
            >
              {tabs.map((tab, index) => (
                <Tab 
                  key={tab.value}
                  icon={
                    <Box sx={{ 
                      color: tabValue === index ? `${tab.color}.main` : 'text.secondary',
                      transition: 'color 0.2s ease'
                    }}>
                      {tab.icon}
                    </Box>
                  } 
                  label={
                    <Stack spacing={0.5} alignItems="center">
                      <Typography variant="subtitle2" fontWeight="inherit">
                        {tab.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {index === 0 && 'Live Market Data'}
                        {index === 1 && 'Hot Stocks'}
                        {index === 2 && 'AI Verified'}
                        {index === 3 && 'System Insights'}
                      </Typography>
                    </Stack>
                  }
                  id={`dashboard-tab-${index}`}
                  aria-controls={`dashboard-tabpanel-${index}`}
                />
              ))}
            </Tabs>
          </Box>

          {loading && (
            <LinearProgress 
              sx={{
                height: 2,
                '& .MuiLinearProgress-bar': {
                  background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`
                }
              }}
            />
          )}

          <Box sx={{ minHeight: 400 }}>
            <TabPanel value={tabValue} index={0}>
              <MarketOverview 
                systemHealth={systemHealth}
                processingStats={processingStats}
                monitoringStatus={monitoringStatus}
                onStockSelect={handleStockSelect}
              />
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <TrendingStocks 
                mode="trending"
                onStockSelect={handleStockSelect}
              />
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <TrendingStocks 
                mode="validated"
                onStockSelect={handleStockSelect}
              />
            </TabPanel>

            <TabPanel value={tabValue} index={3}>
              <SystemStatus 
                systemHealth={systemHealth}
                processingStats={processingStats}
                monitoringStatus={monitoringStatus}
                lastUpdate={lastUpdate}
              />
            </TabPanel>
          </Box>
        </Paper>
      </Fade>
    </Box>
  );
}

export default Dashboard;
