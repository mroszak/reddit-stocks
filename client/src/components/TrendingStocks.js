import React, { useState, useEffect } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Avatar,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Stack,
  Divider,
  Button,
  ButtonGroup,
  Skeleton,
  Fade,
  Zoom,
  useTheme,
  alpha,
  Badge
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Speed as SpeedIcon,
  Psychology as PsychologyIcon,
  Groups as GroupsIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Star as StarIcon,
  Warning as WarningIcon,
  ShowChart as ShowChartIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Sort as SortIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  Search as SearchIcon,
  Clear as ClearIcon
} from '@mui/icons-material';

import { ApiService } from '../services/ApiService';
import { WebSocketService } from '../services/WebSocketService';
import ConfidenceIndicator from './ConfidenceIndicator';

function TrendingStocks({ mode = 'trending', onStockSelect }) {
  const theme = useTheme();
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [timeframe, setTimeframe] = useState('24');
  const [minConfidence, setMinConfidence] = useState(50);
  const [sortBy, setSortBy] = useState('trendingScore');
  const [filterTicker, setFilterTicker] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('table');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadStocks();
    setupWebSocketSubscriptions();

    return () => {
      cleanupWebSocketSubscriptions();
    };
  }, [mode, timeframe, minConfidence, sortBy]);

  const loadStocks = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let data;
      const params = {
        timeframe: timeframe,
        limit: 100,
        sortBy: sortBy
      };

      if (mode === 'validated') {
        params.require_validation = true;
        params.minConfidence = minConfidence;
        data = await ApiService.getValidatedTrendingStocks(params);
      } else if (mode === 'enhanced') {
        params.minConfidence = minConfidence;
        data = await ApiService.getEnhancedTrendingStocks(params);
      } else {
        data = await ApiService.getTrendingStocks(params);
      }

      const stocksData = data.data || data.stocks || data || [];
      setStocks(Array.isArray(stocksData) ? stocksData : []);
    } catch (err) {
      setError(err.message || 'Failed to load trending stocks');
      setStocks([]);
    } finally {
      setLoading(false);
    }
  };

  const setupWebSocketSubscriptions = () => {
    WebSocketService.subscribe('trendingUpdate', (data) => {
      if (data.mode === mode || !data.mode) {
        const stocksData = data.data || data.stocks || data || [];
        setStocks(Array.isArray(stocksData) ? stocksData : []);
      }
    });

    WebSocketService.subscribe('stockUpdate', (data) => {
      setStocks(prev => {
        if (!Array.isArray(prev)) {
          return [];
        }
        return prev.map(stock => 
          stock.ticker === data.ticker 
            ? { ...stock, ...data }
            : stock
        );
      });
    });
  };

  const cleanupWebSocketSubscriptions = () => {
    WebSocketService.unsubscribe('trendingUpdate');
    WebSocketService.unsubscribe('stockUpdate');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStocks();
    setRefreshing(false);
  };

  const handleStockClick = (ticker) => {
    if (onStockSelect) {
      onStockSelect(ticker);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getSentimentIcon = (sentiment) => {
    if (sentiment > 20) return <TrendingUpIcon color="success" />;
    if (sentiment < -20) return <TrendingDownIcon color="error" />;
    return <TrendingFlatIcon color="warning" />;
  };

  const getSentimentColor = (sentiment) => {
    if (sentiment > 20) return 'success';
    if (sentiment < -20) return 'error';
    return 'warning';
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 80) return 'success';
    if (confidence >= 60) return 'info';
    if (confidence >= 40) return 'warning';
    return 'error';
  };

  const getTrendingBadge = (score) => {
    if (score >= 80) return { label: '🔥 Hot', color: 'error' };
    if (score >= 60) return { label: '⚡ Rising', color: 'warning' };
    if (score >= 40) return { label: '📈 Trending', color: 'info' };
    return { label: '👀 Watch', color: 'default' };
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num?.toString() || '0';
  };

  const formatPercentage = (num) => {
    return `${num > 0 ? '+' : ''}${num?.toFixed(1) || 0}%`;
  };

  // Mini sparkline component for sentiment trend
  const SentimentSparkline = ({ sentiment, mentions }) => {
    const width = 60;
    const height = 24;
    const points = 10;
    
    // Generate mock historical data based on current sentiment
    const generateSparklineData = () => {
      const data = [];
      for (let i = 0; i < points; i++) {
        const variance = (Math.random() - 0.5) * 20;
        data.push(Math.max(-100, Math.min(100, sentiment + variance)));
      }
      return data;
    };

    const data = generateSparklineData();
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    const pathData = data.map((value, index) => {
      const x = (index / (points - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    const color = sentiment > 20 ? theme.palette.success.main : 
                  sentiment < -20 ? theme.palette.error.main : 
                  theme.palette.warning.main;

    return (
      <Box sx={{ width, height, position: 'relative' }}>
        <svg width={width} height={height} style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id={`gradient-${Math.random()}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <path
            d={pathData}
            stroke={color}
            strokeWidth={1.5}
            fill="none"
            opacity={0.8}
          />
          <circle
            cx={width}
            cy={height - ((sentiment - min) / range) * height}
            r={2}
            fill={color}
          />
        </svg>
      </Box>
    );
  };

  // Enhanced stock row component
  const StockRow = ({ stock, index }) => {
    const sentiment = stock.sentiment || stock.sentimentScore || 0;
    const confidence = stock.confidence || stock.confidenceScore || 0;
    const mentions = stock.mentions || stock.mentionCount || 0;
    const qualityUsers = stock.qualityUsers || stock.highQualityMentions || 0;
    const subredditCount = stock.subredditCount || stock.crossValidation?.subredditCount || 1;
    const trendingBadge = getTrendingBadge(stock.trendingScore || stock.score || 0);

    return (
      <Zoom in timeout={300 + index * 50}>
        <TableRow 
          hover
          onClick={() => handleStockClick(stock.ticker)}
          sx={{ 
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': { 
              bgcolor: alpha(theme.palette.primary.main, 0.04),
              transform: 'scale(1.01)',
              boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.1)}`
            },
            '&:active': {
              transform: 'scale(0.99)'
            }
          }}
        >
          {/* Ticker & Company */}
          <TableCell>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Badge
                badgeContent={stock.crossValidated ? <StarIcon sx={{ fontSize: 12 }} /> : null}
                color="warning"
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                <Avatar 
                  sx={{ 
                    width: 44, 
                    height: 44, 
                    bgcolor: `${trendingBadge.color}.main`,
                    fontWeight: 700,
                    fontSize: '1.1rem'
                  }}
                >
                  {stock.ticker?.charAt(0) || '?'}
                </Avatar>
              </Badge>
              
              <Box>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="h6" fontWeight={700}>
                    {stock.ticker || 'Unknown'}
                  </Typography>
                  <Chip
                    label={trendingBadge.label}
                    color={trendingBadge.color}
                    size="small"
                    sx={{ height: 20, fontSize: '0.75rem' }}
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {stock.company || 'Unknown Company'}
                </Typography>
              </Box>
            </Stack>
          </TableCell>

          {/* Sentiment with Sparkline */}
          <TableCell align="center">
            <Stack alignItems="center" spacing={1}>
              <Stack direction="row" alignItems="center" spacing={1}>
                {getSentimentIcon(sentiment)}
                <Typography variant="h6" fontWeight={600}>
                  {formatPercentage(sentiment)}
                </Typography>
              </Stack>
              <SentimentSparkline sentiment={sentiment} mentions={mentions} />
            </Stack>
          </TableCell>

          {/* Trending Score */}
          <TableCell align="center">
            <Stack alignItems="center" spacing={1}>
              <Typography variant="h5" fontWeight={700} color="primary.main">
                {(stock.trendingScore || stock.score || 0).toFixed(1)}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, (stock.trendingScore || stock.score || 0))}
                sx={{
                  width: 60,
                  height: 6,
                  borderRadius: 3,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`
                  }
                }}
              />
            </Stack>
          </TableCell>

          {/* Mentions */}
          <TableCell align="center">
            <Stack alignItems="center" spacing={0.5}>
              <Typography variant="h6" fontWeight={600}>
                {formatNumber(mentions)}
              </Typography>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <SpeedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  mentions
                </Typography>
              </Stack>
            </Stack>
          </TableCell>

          {/* Confidence */}
          <TableCell align="center">
            <Stack alignItems="center" spacing={1}>
              <Typography variant="h6" fontWeight={600}>
                {confidence.toFixed(0)}%
              </Typography>
              <ConfidenceIndicator 
                value={confidence} 
                size="small"
                showLabel={false}
              />
            </Stack>
          </TableCell>

          {/* Subreddits */}
          <TableCell align="center">
            <Stack alignItems="center" spacing={0.5}>
              <Typography variant="h6" fontWeight={600}>
                {subredditCount}
              </Typography>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <GroupsIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  sources
                </Typography>
              </Stack>
            </Stack>
          </TableCell>

          {/* Quality Users */}
          <TableCell align="center">
            <Stack alignItems="center" spacing={0.5}>
              <Typography variant="h6" fontWeight={600}>
                {formatNumber(qualityUsers)}
              </Typography>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <PsychologyIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  quality
                </Typography>
              </Stack>
            </Stack>
          </TableCell>

          {/* Status & Alerts */}
          <TableCell align="center">
            <Stack alignItems="center" spacing={1}>
              {stock.alerts && stock.alerts.length > 0 && (
                <Tooltip title={`${stock.alerts.length} alerts`}>
                  <Chip
                    icon={<WarningIcon />}
                    label={stock.alerts.length}
                    color="warning"
                    size="small"
                  />
                </Tooltip>
              )}
              
              {stock.velocity > 2 && (
                <Chip
                  label="🚀 High Velocity"
                  color="secondary"
                  size="small"
                  sx={{ fontSize: '0.7rem' }}
                />
              )}
              
              {stock.manipulationRisk > 70 && (
                <Tooltip title="High manipulation risk detected">
                  <Chip
                    icon={<WarningIcon />}
                    label="Risk"
                    color="error"
                    size="small"
                  />
                </Tooltip>
              )}
            </Stack>
          </TableCell>
        </TableRow>
      </Zoom>
    );
  };

  const filteredStocks = (Array.isArray(stocks) ? stocks : []).filter(stock => 
    !filterTicker || (stock.ticker && stock.ticker.toLowerCase().includes(filterTicker.toLowerCase()))
  );

  const paginatedStocks = filteredStocks.slice(
    page * rowsPerPage, 
    page * rowsPerPage + rowsPerPage
  );

  const getModeTitle = () => {
    switch (mode) {
      case 'validated': return '✅ Cross-Validated Trending Stocks';
      case 'enhanced': return '🧠 AI-Enhanced Trending Stocks';
      default: return '📈 Trending Stocks';
    }
  };

  const getModeDescription = () => {
    switch (mode) {
      case 'validated': return 'Stocks verified across multiple subreddits with high confidence';
      case 'enhanced': return 'Advanced AI analysis with comprehensive sentiment scoring';
      default: return 'Popular stocks based on Reddit mention volume and sentiment';
    }
  };

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        minHeight: 300,
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress size={60} thickness={4} />
        <Typography variant="body2" color="text.secondary">
          Loading trending stocks...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Enhanced Header */}
      <Fade in timeout={400}>
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Box>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
                <Typography 
                  variant="h4" 
                  fontWeight={700}
                  sx={{
                    background: mode === 'validated' 
                      ? `linear-gradient(135deg, ${theme.palette.info.main}, ${theme.palette.primary.main})`
                      : `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.success.main})`,
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                >
                  {getModeTitle()}
                </Typography>
                <Chip
                  label={`${filteredStocks.length} stocks`}
                  color="primary"
                  variant="outlined"
                  size="small"
                />
              </Stack>
              <Typography variant="body1" color="text.secondary">
                {getModeDescription()}
              </Typography>
            </Box>
            
            <Stack direction="row" alignItems="center" spacing={1}>
              <ButtonGroup variant="outlined" size="small">
                <Button
                  startIcon={<ViewListIcon />}
                  onClick={() => setViewMode('table')}
                  variant={viewMode === 'table' ? 'contained' : 'outlined'}
                >
                  Table
                </Button>
                <Button
                  startIcon={<ViewModuleIcon />}
                  onClick={() => setViewMode('cards')}
                  variant={viewMode === 'cards' ? 'contained' : 'outlined'}
                >
                  Cards
                </Button>
              </ButtonGroup>
              
              <Tooltip title={showFilters ? 'Hide Filters' : 'Show Filters'}>
                <IconButton 
                  onClick={() => setShowFilters(!showFilters)}
                  sx={{
                    bgcolor: showFilters ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.2),
                    }
                  }}
                >
                  <FilterIcon />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Refresh Data">
                <IconButton 
                  onClick={handleRefresh} 
                  disabled={refreshing}
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

      {/* Enhanced Collapsible Filters */}
      <Fade in={showFilters} timeout={300}>
        <Card 
          variant="trading"
          sx={{ 
            mb: 3,
            display: showFilters ? 'block' : 'none',
            borderRadius: 2,
            overflow: 'hidden'
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={3}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <FilterIcon color="primary" />
                  <Typography variant="h6" fontWeight={600}>
                    Advanced Filters
                  </Typography>
                </Stack>
                <IconButton 
                  size="small" 
                  onClick={() => setShowFilters(false)}
                  sx={{ 
                    bgcolor: alpha(theme.palette.error.main, 0.1),
                    '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2) }
                  }}
                >
                  <ClearIcon />
                </IconButton>
              </Stack>

              <Grid container spacing={3} alignItems="center">
                {/* Quick Search */}
                <Grid xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Search Stocks"
                    value={filterTicker}
                    onChange={(e) => setFilterTicker(e.target.value)}
                    placeholder="e.g., TSLA, AAPL, GME"
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                      endAdornment: filterTicker && (
                        <IconButton 
                          size="small" 
                          onClick={() => setFilterTicker('')}
                        >
                          <ClearIcon />
                        </IconButton>
                      )
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                      }
                    }}
                  />
                </Grid>

                {/* Timeframe */}
                <Grid xs={12} sm={6} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Timeframe</InputLabel>
                    <Select
                      value={timeframe}
                      label="Timeframe"
                      onChange={(e) => setTimeframe(e.target.value)}
                      sx={{ borderRadius: 2 }}
                    >
                      <MenuItem value="1">1 Hour</MenuItem>
                      <MenuItem value="6">6 Hours</MenuItem>
                      <MenuItem value="24">24 Hours</MenuItem>
                      <MenuItem value="72">3 Days</MenuItem>
                      <MenuItem value="168">1 Week</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Confidence Filter */}
                {(mode === 'validated' || mode === 'enhanced') && (
                  <Grid xs={12} sm={6} md={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Min Confidence</InputLabel>
                      <Select
                        value={minConfidence}
                        label="Min Confidence"
                        onChange={(e) => setMinConfidence(e.target.value)}
                        sx={{ borderRadius: 2 }}
                      >
                        <MenuItem value={0}>Any</MenuItem>
                        <MenuItem value={50}>50%+</MenuItem>
                        <MenuItem value={70}>70%+</MenuItem>
                        <MenuItem value={80}>80%+</MenuItem>
                        <MenuItem value={90}>90%+</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                )}

                {/* Sort By */}
                <Grid xs={12} sm={6} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Sort By</InputLabel>
                    <Select
                      value={sortBy}
                      label="Sort By"
                      onChange={(e) => setSortBy(e.target.value)}
                      sx={{ borderRadius: 2 }}
                    >
                      <MenuItem value="trendingScore">
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <TrendingUpIcon fontSize="small" />
                          <span>Trending Score</span>
                        </Stack>
                      </MenuItem>
                      <MenuItem value="mentions">
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <SpeedIcon fontSize="small" />
                          <span>Mentions</span>
                        </Stack>
                      </MenuItem>
                      <MenuItem value="sentiment">
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <ShowChartIcon fontSize="small" />
                          <span>Sentiment</span>
                        </Stack>
                      </MenuItem>
                      <MenuItem value="confidence">
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <PsychologyIcon fontSize="small" />
                          <span>Confidence</span>
                        </Stack>
                      </MenuItem>
                      <MenuItem value="velocity">Velocity</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Results Summary */}
                <Grid xs={12} md={2}>
                  <Paper 
                    sx={{ 
                      p: 2, 
                      textAlign: 'center',
                      bgcolor: alpha(theme.palette.primary.main, 0.05),
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
                    }}
                  >
                    <Typography variant="h6" fontWeight={700} color="primary.main">
                      {filteredStocks.length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      stocks found
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Stack>
          </CardContent>
        </Card>
      </Fade>

      {/* Enhanced Stocks Table */}
      <Fade in timeout={600}>
        <Paper 
          variant="trading"
          sx={{ 
            borderRadius: 3,
            overflow: 'hidden',
            boxShadow: theme.shadows[8]
          }}
        >
          <TableContainer>
            <Table sx={{ minWidth: 1000 }}>
              <TableHead>
                <TableRow sx={{ 
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                  '& .MuiTableCell-head': {
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    py: 2
                  }
                }}>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="overline" fontWeight={700}>Stock</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
                      <ShowChartIcon fontSize="small" />
                      <Typography variant="overline" fontWeight={700}>Sentiment</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
                      <TrendingUpIcon fontSize="small" />
                      <Typography variant="overline" fontWeight={700}>Score</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
                      <SpeedIcon fontSize="small" />
                      <Typography variant="overline" fontWeight={700}>Mentions</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
                      <PsychologyIcon fontSize="small" />
                      <Typography variant="overline" fontWeight={700}>Confidence</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
                      <GroupsIcon fontSize="small" />
                      <Typography variant="overline" fontWeight={700}>Sources</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
                      <VisibilityIcon fontSize="small" />
                      <Typography variant="overline" fontWeight={700}>Quality</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="overline" fontWeight={700}>Status</Typography>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedStocks.length > 0 ? (
                  paginatedStocks.map((stock, index) => (
                    <StockRow 
                      key={stock.ticker || index} 
                      stock={stock} 
                      index={index}
                    />
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                      <Stack alignItems="center" spacing={2}>
                        <VisibilityOffIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
                        <Typography variant="h6" color="text.secondary">
                          No stocks found
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Try adjusting your filters or check back later
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Divider />
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={filteredStocks.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            sx={{
              '& .MuiTablePagination-toolbar': {
                px: 3,
                py: 2
              },
              '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                fontWeight: 500
              }
            }}
          />
        </Paper>
      </Fade>
    </Box>
  );
}

export default TrendingStocks;
