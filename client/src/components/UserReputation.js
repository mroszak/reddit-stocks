import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Chip,
  LinearProgress,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Alert
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  TrendingUp as TrendingUpIcon,
  Star as StarIcon,
  EmojiEvents as TrophyIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon
} from '@mui/icons-material';

import { ApiService } from '../services/ApiService';
import ConfidenceIndicator from './ConfidenceIndicator';

function UserReputation() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchUser, setSearchUser] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [searchedUser, setSearchedUser] = useState(null);

  useEffect(() => {
    loadTopUsers();
  }, [tierFilter]);

  const loadTopUsers = async () => {
    setLoading(true);
    try {
      const params = {
        limit: 50
      };
      if (tierFilter !== 'all') {
        params.tier = tierFilter;
      }
      
      const response = await ApiService.getTopUsers(params);
      // Handle the response structure: { success: true, data: [...], metadata: {...} }
      const usersData = response.data || response.users || response || [];
      // Ensure we always have an array
      setUsers(Array.isArray(usersData) ? usersData : []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load user reputation data');
      // Set empty array on error to prevent filter errors
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchUser = async () => {
    if (!searchUser.trim()) return;
    
    try {
      const userData = await ApiService.getUserReputation(searchUser.trim());
      setSearchedUser(userData);
    } catch (err) {
      setError(`Failed to find user: ${searchUser}`);
      setSearchedUser(null);
    }
  };

  const getBadgeColor = (badge) => {
    const badgeColors = {
      'Oracle': 'error',
      'Expert': 'warning',
      'Analyst': 'info',
      'Educator': 'success',
      'DD Master': 'secondary',
      'Rising Star': 'primary',
      'Veteran': 'default'
    };
    return badgeColors[badge] || 'default';
  };

  const getTierColor = (tier) => {
    const tierColors = {
      'expert': 'error',
      'advanced': 'warning',
      'intermediate': 'info',
      'novice': 'success',
      'unknown': 'default'
    };
    return tierColors[tier?.toLowerCase()] || 'default';
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num?.toString() || '0';
  };

  const formatPercentage = (num) => {
    return `${(num || 0).toFixed(1)}%`;
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          👥 User Reputation & Quality Analysis
        </Typography>
        <IconButton onClick={loadTopUsers}>
          <RefreshIcon />
        </IconButton>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Search & Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  label="Search User"
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  placeholder="Enter username (without u/)"
                  size="small"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchUser()}
                />
                <IconButton onClick={handleSearchUser} color="primary">
                  <SearchIcon />
                </IconButton>
              </Box>
            </Grid>
            
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Reputation Tier</InputLabel>
                <Select
                  value={tierFilter}
                  label="Reputation Tier"
                  onChange={(e) => setTierFilter(e.target.value)}
                >
                  <MenuItem value="all">All Tiers</MenuItem>
                  <MenuItem value="expert">Expert</MenuItem>
                  <MenuItem value="advanced">Advanced</MenuItem>
                  <MenuItem value="intermediate">Intermediate</MenuItem>
                  <MenuItem value="novice">Novice</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <Typography variant="body2" color="text.secondary">
                {Array.isArray(users) ? users.length : 0} users found
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Search Result */}
      {searchedUser && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              🔍 Search Result
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.main' }}>
                {searchedUser.username?.charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6">
                  u/{searchedUser.username}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <Chip
                    label={searchedUser.reputation_tier || 'Unknown'}
                    color={getTierColor(searchedUser.reputation_tier)}
                    size="small"
                  />
                  {searchedUser.badges?.map((badge, index) => (
                    <Chip
                      key={index}
                      label={badge}
                      color={getBadgeColor(badge)}
                      size="small"
                      icon={<StarIcon />}
                    />
                  ))}
                </Box>
              </Box>
              <ConfidenceIndicator
                value={searchedUser.reputation_score || 0}
                size="large"
                showLabel={true}
              />
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <TrophyIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {Array.isArray(users) ? users.filter(u => u.reputation_tier === 'expert').length : 0}
                  </Typography>
                  <Typography color="text.secondary">
                    Expert Users
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'success.main' }}>
                  <TrendingUpIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {Array.isArray(users) && users.length > 0 
                      ? (users.reduce((sum, u) => sum + (u.prediction_accuracy || 0), 0) / users.length).toFixed(1)
                      : '0'
                    }%
                  </Typography>
                  <Typography color="text.secondary">
                    Avg Accuracy
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'info.main' }}>
                  <PsychologyIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {Array.isArray(users) && users.length > 0 
                      ? (users.reduce((sum, u) => sum + (u.content_quality || 0), 0) / users.length).toFixed(1)
                      : '0'
                    }
                  </Typography>
                  <Typography color="text.secondary">
                    Avg Quality Score
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'warning.main' }}>
                  <StarIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {Array.isArray(users) ? users.filter(u => u.badges && u.badges.length > 0).length : 0}
                  </Typography>
                  <Typography color="text.secondary">
                    Badge Holders
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* User Reputation Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🏆 Top Quality Contributors
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell align="center">Reputation Tier</TableCell>
                  <TableCell align="center">Reputation Score</TableCell>
                  <TableCell align="center">Prediction Accuracy</TableCell>
                  <TableCell align="center">Content Quality</TableCell>
                  <TableCell align="center">Account Age</TableCell>
                  <TableCell align="center">Badges</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Array.isArray(users) && users.map((user, index) => (
                  <TableRow key={user.username || index} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                          {user.username?.charAt(0).toUpperCase() || '?'}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold">
                            u/{user.username || 'Unknown'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatNumber(user.karma || 0)} karma
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    <TableCell align="center">
                      <Chip
                        label={user.reputation_tier || 'Unknown'}
                        color={getTierColor(user.reputation_tier)}
                        size="small"
                      />
                    </TableCell>

                    <TableCell align="center">
                      <ConfidenceIndicator
                        value={user.reputation_score || 0}
                        size="small"
                        variant="chip"
                        showLabel={true}
                      />
                    </TableCell>

                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <Typography variant="body2">
                          {formatPercentage(user.prediction_accuracy)}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={user.prediction_accuracy || 0}
                          color={
                            (user.prediction_accuracy || 0) > 70 
                              ? 'success' 
                              : (user.prediction_accuracy || 0) > 50 
                                ? 'warning' 
                                : 'error'
                          }
                          sx={{ width: 40, height: 4 }}
                        />
                      </Box>
                    </TableCell>

                    <TableCell align="center">
                      <Typography variant="body2">
                        {(user.content_quality || 0).toFixed(1)}
                      </Typography>
                    </TableCell>

                    <TableCell align="center">
                      <Typography variant="body2">
                        {user.account_age ? `${user.account_age} days` : 'Unknown'}
                      </Typography>
                    </TableCell>

                    <TableCell align="center">
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
                        {user.badges && user.badges.length > 0 ? (
                          user.badges.slice(0, 2).map((badge, badgeIndex) => (
                            <Chip
                              key={badgeIndex}
                              label={badge}
                              color={getBadgeColor(badge)}
                              size="small"
                              icon={<StarIcon />}
                            />
                          ))
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            No badges
                          </Typography>
                        )}
                        {user.badges && user.badges.length > 2 && (
                          <Tooltip title={user.badges.slice(2).join(', ')}>
                            <Chip
                              label={`+${user.badges.length - 2}`}
                              color="default"
                              size="small"
                            />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {Array.isArray(users) && users.length === 0 && !loading && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary">
                No user reputation data available
              </Typography>
              <Typography variant="body2" color="text.secondary">
                User reputation analysis will be populated as the system processes more data
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}

export default UserReputation;
