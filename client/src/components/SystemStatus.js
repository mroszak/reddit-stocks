import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Divider,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  Cloud as CloudIcon,
  Timer as TimerIcon,
  Refresh as RefreshIcon,
  Psychology as PsychologyIcon,
  Article as ArticleIcon,
  TrendingUp as TrendingUpIcon,
  Groups as GroupsIcon
} from '@mui/icons-material';

import { ApiService } from '../services/ApiService';
import { WebSocketService } from '../services/WebSocketService';

function SystemStatus({ systemHealth, processingStats, monitoringStatus, lastUpdate }) {
  const [apiUsage, setApiUsage] = useState({});
  const [analysisStatus, setAnalysisStatus] = useState(null);
  const [wsStatus, setWsStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSystemDetails();
    setWsStatus(WebSocketService.getStatus());

    const interval = setInterval(() => {
      setWsStatus(WebSocketService.getStatus());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadSystemDetails = async () => {
    setLoading(true);
    try {
      const [claude, news, economic, analysis] = await Promise.allSettled([
        ApiService.getClaudeUsage(),
        ApiService.getNewsUsage(),
        ApiService.getEconomicUsage(),
        ApiService.getAnalysisStatus()
      ]);

      const usage = {};
      if (claude.status === 'fulfilled') usage.claude = claude.value;
      if (news.status === 'fulfilled') usage.news = news.value;
      if (economic.status === 'fulfilled') usage.economic = economic.value;
      
      setApiUsage(usage);
      
      if (analysis.status === 'fulfilled') {
        setAnalysisStatus(analysis.value);
      }
    } catch (error) {
      console.error('Failed to load system details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status, isConnected = null) => {
    if (isConnected !== null) {
      return isConnected ? 
        <CheckCircleIcon color="success" /> : 
        <ErrorIcon color="error" />;
    }
    
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'running':
      case 'active':
      case 'connected':
        return <CheckCircleIcon color="success" />;
      case 'warning':
      case 'limited':
        return <WarningIcon color="warning" />;
      case 'error':
      case 'stopped':
      case 'inactive':
      case 'disconnected':
        return <ErrorIcon color="error" />;
      default:
        return <TimerIcon color="action" />;
    }
  };

  const getStatusColor = (status, isConnected = null) => {
    if (isConnected !== null) {
      return isConnected ? 'success' : 'error';
    }
    
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'running':
      case 'active':
      case 'connected':
        return 'success';
      case 'warning':
      case 'limited':
        return 'warning';
      case 'error':
      case 'stopped':
      case 'inactive':
      case 'disconnected':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num?.toString() || '0';
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getUsagePercentage = (used, limit) => {
    if (!used || !limit) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage) => {
    if (percentage >= 90) return 'error';
    if (percentage >= 70) return 'warning';
    return 'success';
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          🔧 System Status & Analytics
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Last updated: {lastUpdate?.toLocaleTimeString() || 'Never'}
          </Typography>
          <Tooltip title="Refresh System Data">
            <span>
              <IconButton onClick={loadSystemDetails} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      <Grid container spacing={3}>
        {/* Core System Health */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🏥 Core System Health
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    {getStatusIcon(systemHealth?.status)}
                  </ListItemIcon>
                  <ListItemText
                    primary="Application Health"
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip 
                          label={systemHealth?.status || 'Unknown'} 
                          color={getStatusColor(systemHealth?.status)}
                          size="small"
                        />
                        {systemHealth?.uptime && (
                          <Typography variant="caption" color="text.secondary">
                            Uptime: {systemHealth.uptime}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    {getStatusIcon(monitoringStatus?.status)}
                  </ListItemIcon>
                  <ListItemText
                    primary="Monitoring Service"
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip 
                          label={monitoringStatus?.status || 'Unknown'} 
                          color={getStatusColor(monitoringStatus?.status)}
                          size="small"
                        />
                        {monitoringStatus?.nextRun && (
                          <Typography variant="caption" color="text.secondary">
                            Next run: {new Date(monitoringStatus.nextRun).toLocaleTimeString()}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    {getStatusIcon(null, wsStatus?.connected)}
                  </ListItemIcon>
                  <ListItemText
                    primary="WebSocket Connection"
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip 
                          label={wsStatus?.connected ? 'Connected' : 'Disconnected'} 
                          color={getStatusColor(null, wsStatus?.connected)}
                          size="small"
                        />
                        <Typography variant="caption" color="text.secondary">
                          {wsStatus?.subscriberCount || 0} subscribers
                        </Typography>
                        {wsStatus?.reconnectAttempts > 0 && (
                          <Typography variant="caption" color="error">
                            {wsStatus.reconnectAttempts} reconnect attempts
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Database Statistics */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <StorageIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Database Statistics
              </Typography>
              {processingStats ? (
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6 }}>
                    <Box sx={{ textAlign: 'center', p: 1 }}>
                      <Typography variant="h4" color="primary">
                        {formatNumber(processingStats.database?.total_posts || 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Posts
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Box sx={{ textAlign: 'center', p: 1 }}>
                      <Typography variant="h4" color="secondary">
                        {processingStats.database?.unique_tickers || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Unique Tickers
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Box sx={{ textAlign: 'center', p: 1 }}>
                      <Typography variant="h4" color="info.main">
                        {formatNumber(processingStats.database?.unique_authors || 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Unique Authors
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Box sx={{ textAlign: 'center', p: 1 }}>
                      <Typography variant="h4" color="warning.main">
                        {formatNumber(processingStats.database?.processed_posts || 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Processed Posts
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Database statistics unavailable
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* API Usage Statistics */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <CloudIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                API Usage & Rate Limits
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Service</TableCell>
                      <TableCell align="center">Status</TableCell>
                      <TableCell align="center">Usage</TableCell>
                      <TableCell align="center">Rate Limit</TableCell>
                      <TableCell align="center">Next Reset</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {/* Claude API */}
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PsychologyIcon color="primary" />
                          <Typography variant="body2">Claude AI</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={apiUsage.claude?.status || 'Unknown'} 
                          color={getStatusColor(apiUsage.claude?.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        {apiUsage.claude && (
                          <Box>
                            <LinearProgress
                              variant="determinate"
                              value={getUsagePercentage(apiUsage.claude.used, apiUsage.claude.limit)}
                              color={getUsageColor(getUsagePercentage(apiUsage.claude.used, apiUsage.claude.limit))}
                              sx={{ mb: 0.5 }}
                            />
                            <Typography variant="caption">
                              {apiUsage.claude.used || 0} / {apiUsage.claude.limit || 'Unknown'}
                            </Typography>
                          </Box>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="caption">
                          {apiUsage.claude?.rateLimit || '1/sec'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="caption">
                          {apiUsage.claude?.resetTime || 'N/A'}
                        </Typography>
                      </TableCell>
                    </TableRow>

                    {/* News API */}
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ArticleIcon color="info" />
                          <Typography variant="body2">NewsAPI</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={apiUsage.news?.status || 'Unknown'} 
                          color={getStatusColor(apiUsage.news?.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        {apiUsage.news && (
                          <Box>
                            <LinearProgress
                              variant="determinate"
                              value={getUsagePercentage(apiUsage.news.used, apiUsage.news.limit)}
                              color={getUsageColor(getUsagePercentage(apiUsage.news.used, apiUsage.news.limit))}
                              sx={{ mb: 0.5 }}
                            />
                            <Typography variant="caption">
                              {apiUsage.news.used || 0} / {apiUsage.news.limit || 'Unknown'}
                            </Typography>
                          </Box>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="caption">
                          {apiUsage.news?.rateLimit || '900/day'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="caption">
                          {apiUsage.news?.resetTime || 'Daily'}
                        </Typography>
                      </TableCell>
                    </TableRow>

                    {/* FRED API */}
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TrendingUpIcon color="success" />
                          <Typography variant="body2">FRED Economic</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={apiUsage.economic?.status || 'Unknown'} 
                          color={getStatusColor(apiUsage.economic?.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        {apiUsage.economic && (
                          <Box>
                            <LinearProgress
                              variant="determinate"
                              value={getUsagePercentage(apiUsage.economic.used, apiUsage.economic.limit)}
                              color={getUsageColor(getUsagePercentage(apiUsage.economic.used, apiUsage.economic.limit))}
                              sx={{ mb: 0.5 }}
                            />
                            <Typography variant="caption">
                              {apiUsage.economic.used || 0} / {apiUsage.economic.limit || 'Unlimited'}
                            </Typography>
                          </Box>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="caption">
                          {apiUsage.economic?.rateLimit || '0.5/sec'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="caption">
                          {apiUsage.economic?.resetTime || 'N/A'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Processing Statistics */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <SpeedIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Processing Performance
              </Typography>
              {processingStats?.processing ? (
                <List>
                  <ListItem>
                    <ListItemText
                      primary="Posts Processed"
                      secondary={formatNumber(processingStats.processing.posts_processed)}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Posts Filtered"
                      secondary={formatNumber(processingStats.processing.posts_filtered)}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Tickers Extracted"
                      secondary={formatNumber(processingStats.processing.tickers_extracted)}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Sentiment Analyzed"
                      secondary={formatNumber(processingStats.processing.sentiment_analyzed)}
                    />
                  </ListItem>
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Processing statistics unavailable
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Phase 3 Analysis Status */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🧠 Advanced Analysis Status
              </Typography>
              {analysisStatus ? (
                <List>
                  <ListItem>
                    <ListItemIcon>
                      {getStatusIcon(analysisStatus.claude?.status)}
                    </ListItemIcon>
                    <ListItemText
                      primary="Claude AI Analysis"
                      secondary={
                        <Chip 
                          label={analysisStatus.claude?.status || 'Unknown'} 
                          color={getStatusColor(analysisStatus.claude?.status)}
                          size="small"
                        />
                      }
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      {getStatusIcon(analysisStatus.news?.status)}
                    </ListItemIcon>
                    <ListItemText
                      primary="News Correlation"
                      secondary={
                        <Chip 
                          label={analysisStatus.news?.status || 'Unknown'} 
                          color={getStatusColor(analysisStatus.news?.status)}
                          size="small"
                        />
                      }
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      {getStatusIcon(analysisStatus.economic?.status)}
                    </ListItemIcon>
                    <ListItemText
                      primary="Economic Integration"
                      secondary={
                        <Chip 
                          label={analysisStatus.economic?.status || 'Unknown'} 
                          color={getStatusColor(analysisStatus.economic?.status)}
                          size="small"
                        />
                      }
                    />
                  </ListItem>
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Analysis status unavailable
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default SystemStatus;
