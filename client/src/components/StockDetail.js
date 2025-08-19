import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  IconButton,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  Chip,
  Stack,
  Fade,
  useTheme,
  alpha,
  Avatar,
  Divider
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  TrendingUp as TrendingUpIcon,
  Refresh as RefreshIcon,
  Timeline as TimelineIcon,
  Psychology as PsychologyIcon,
  Article as ArticleIcon,
  TrendingFlat as TrendingFlatIcon,
  TrendingDown as TrendingDownIcon
} from '@mui/icons-material';

import { ApiService } from '../services/ApiService';
import ConfidenceIndicator from './ConfidenceIndicator';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`stock-tabpanel-${index}`}
      aria-labelledby={`stock-tab-${index}`}
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

function StockDetail({ ticker, onBack }) {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stockData, setStockData] = useState(null);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    if (ticker) {
      loadStockData();
    }
  }, [ticker]);

  const loadStockData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await ApiService.getComprehensiveStockAnalysis(ticker);
      setStockData(data);
    } catch (err) {
      setError(err.message || 'Failed to load stock data');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const getSentimentIcon = (sentiment) => {
    if (sentiment > 20) return <TrendingUpIcon color="success" />;
    if (sentiment < -20) return <TrendingDownIcon color="error" />;
    return <TrendingFlatIcon color="warning" />;
  };

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        minHeight: '60vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress size={60} thickness={4} />
        <Typography variant="body2" color="text.secondary">
          Loading {ticker} analysis...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Enhanced Header */}
      <Fade in timeout={400}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 4 }}>
          <IconButton 
            onClick={onBack}
            sx={{
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.2),
              }
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          
          <Avatar 
            sx={{ 
              width: 56, 
              height: 56, 
              bgcolor: 'primary.main',
              fontSize: '1.5rem',
              fontWeight: 700
            }}
          >
            {ticker?.charAt(0)}
          </Avatar>
          
          <Box sx={{ flexGrow: 1 }}>
            <Typography 
              variant="h3" 
              fontWeight={700}
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              {ticker}
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Stock Analysis & Sentiment Tracking
            </Typography>
          </Box>
          
          <IconButton 
            onClick={loadStockData}
            sx={{
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.2),
              }
            }}
          >
            <RefreshIcon />
          </IconButton>
        </Stack>
      </Fade>

      {/* Enhanced Stock Overview Cards */}
      <Fade in timeout={600}>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid xs={12} sm={6} lg={3}>
            <Card variant="metric" sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.success.main, 0.1),
                        color: 'success.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {getSentimentIcon(stockData?.sentiment || 0)}
                    </Box>
                  </Stack>
                  
                  <Box>
                    <Typography variant="h3" fontWeight={700} color="text.primary">
                      {stockData?.sentiment?.toFixed(1) || '0'}%
                    </Typography>
                    <Typography variant="overline" color="text.secondary" sx={{ mt: 1 }}>
                      Current Sentiment
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid xs={12} sm={6} lg={3}>
            <Card variant="metric" sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.info.main, 0.1),
                        color: 'info.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <PsychologyIcon />
                    </Box>
                  </Stack>
                  
                  <Box>
                    <Typography variant="h3" fontWeight={700} color="text.primary">
                      {stockData?.confidence?.toFixed(0) || '0'}%
                    </Typography>
                    <Typography variant="overline" color="text.secondary" sx={{ mt: 1 }}>
                      AI Confidence
                    </Typography>
                    <ConfidenceIndicator 
                      value={stockData?.confidence || 0}
                      size="small"
                      showLabel={false}
                      sx={{ mt: 1 }}
                    />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid xs={12} sm={6} lg={3}>
            <Card variant="metric" sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <ArticleIcon />
                    </Box>
                  </Stack>
                  
                  <Box>
                    <Typography variant="h3" fontWeight={700} color="text.primary">
                      {stockData?.mentions?.toLocaleString() || '0'}
                    </Typography>
                    <Typography variant="overline" color="text.secondary" sx={{ mt: 1 }}>
                      Mentions (24h)
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid xs={12} sm={6} lg={3}>
            <Card variant="metric" sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.warning.main, 0.1),
                        color: 'warning.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <TimelineIcon />
                    </Box>
                  </Stack>
                  
                  <Box>
                    <Chip 
                      label={stockData?.crossValidated ? 'AI Validated' : 'Analyzing'}
                      color={stockData?.crossValidated ? 'success' : 'warning'}
                      sx={{ alignSelf: 'flex-start', fontWeight: 600 }}
                    />
                    <Typography variant="overline" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                      Validation Status
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Fade>

      {/* Enhanced Analysis Tabs */}
      <Fade in timeout={800}>
        <Paper 
          variant="trading"
          sx={{ 
            width: '100%',
            borderRadius: 3,
            overflow: 'hidden'
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
              <Tab 
                icon={<TimelineIcon />}
                label="Sentiment Timeline"
                iconPosition="start"
              />
              <Tab 
                icon={<PsychologyIcon />}
                label="Quality Analysis"
                iconPosition="start"
              />
              <Tab 
                icon={<ArticleIcon />}
                label="News Correlation"
                iconPosition="start"
              />
              <Tab 
                icon={<TrendingUpIcon />}
                label="Economic Context"
                iconPosition="start"
              />
            </Tabs>
          </Box>

          <Box sx={{ minHeight: 400, p: 3 }}>
            <TabPanel value={tabValue} index={0}>
              <Stack spacing={3}>
                <Typography variant="h5" fontWeight={600}>
                  📈 Sentiment Timeline Analysis
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Comprehensive sentiment analysis chart with price correlation and volume indicators will be implemented here.
                </Typography>
                <Box sx={{ 
                  height: 300, 
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Typography variant="h6" color="text.secondary">
                    Interactive Chart Coming Soon
                  </Typography>
                </Box>
              </Stack>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <Stack spacing={3}>
                <Typography variant="h5" fontWeight={600}>
                  🎯 Quality Posts & Expert Analysis
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Curated posts from high-reputation users and verified analysts discussing {ticker}.
                </Typography>
                <Box sx={{ 
                  height: 300, 
                  bgcolor: alpha(theme.palette.info.main, 0.05),
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Typography variant="h6" color="text.secondary">
                    Quality Content Feed Coming Soon
                  </Typography>
                </Box>
              </Stack>
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <Stack spacing={3}>
                <Typography variant="h5" fontWeight={600}>
                  📰 News Correlation Analysis
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Comparison between Reddit sentiment and mainstream financial news coverage.
                </Typography>
                <Box sx={{ 
                  height: 300, 
                  bgcolor: alpha(theme.palette.warning.main, 0.05),
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Typography variant="h6" color="text.secondary">
                    News Correlation Dashboard Coming Soon
                  </Typography>
                </Box>
              </Stack>
            </TabPanel>

            <TabPanel value={tabValue} index={3}>
              <Stack spacing={3}>
                <Typography variant="h5" fontWeight={600}>
                  🏛️ Economic Context & Indicators
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Macro-economic indicators and market context affecting {ticker} performance.
                </Typography>
                <Box sx={{ 
                  height: 300, 
                  bgcolor: alpha(theme.palette.success.main, 0.05),
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Typography variant="h6" color="text.secondary">
                    Economic Indicators Coming Soon
                  </Typography>
                </Box>
              </Stack>
            </TabPanel>
          </Box>
        </Paper>
      </Fade>
    </Box>
  );
}

export default StockDetail;
