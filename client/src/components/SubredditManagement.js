import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  LinearProgress,
  Avatar
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  Groups as GroupsIcon,
  TrendingUp as TrendingUpIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

import { ApiService } from '../services/ApiService';

function SubredditManagement() {
  const [subreddits, setSubreddits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedSubreddit, setSelectedSubreddit] = useState(null);
  const [newSubredditName, setNewSubredditName] = useState('');

  useEffect(() => {
    loadSubreddits();
  }, []);

  const loadSubreddits = async () => {
    setLoading(true);
    try {
      const response = await ApiService.getSubreddits();
      // Handle the response structure: { success: true, data: [...], metadata: {...} }
      const subredditsData = response.data || response.subreddits || response || [];
      // Ensure we always have an array
      setSubreddits(Array.isArray(subredditsData) ? subredditsData : []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load subreddits');
      // Set empty array on error to prevent filter errors
      setSubreddits([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSubreddit = async (subredditName) => {
    try {
      await ApiService.toggleSubreddit(subredditName);
      loadSubreddits();
    } catch (err) {
      setError(err.message || 'Failed to toggle subreddit');
    }
  };

  const handleAddSubreddit = () => {
    setSelectedSubreddit(null);
    setNewSubredditName('');
    setOpenDialog(true);
  };

  const handleEditSubreddit = (subreddit) => {
    setSelectedSubreddit(subreddit);
    setOpenDialog(true);
  };

  const handleDeleteSubreddit = async (subredditName) => {
    if (window.confirm(`Are you sure you want to delete r/${subredditName}?`)) {
      try {
        await ApiService.deleteSubreddit(subredditName);
        loadSubreddits();
      } catch (err) {
        setError(err.message || 'Failed to delete subreddit');
      }
    }
  };

  const handleSaveSubreddit = async () => {
    try {
      if (selectedSubreddit) {
        // Update existing
        await ApiService.updateSubreddit(selectedSubreddit.name, selectedSubreddit);
      } else {
        // Add new
        await ApiService.addSubreddit({
          name: newSubredditName,
          config: {
            min_upvotes: 5,
            min_comments: 2,
            quality_threshold: 40,
            max_posts_per_hour: 50
          }
        });
      }
      setOpenDialog(false);
      loadSubreddits();
    } catch (err) {
      setError(err.message || 'Failed to save subreddit');
    }
  };

  const getStatusColor = (isActive) => {
    return isActive ? 'success' : 'default';
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num?.toString() || '0';
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <LinearProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          ⚙️ Subreddit Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddSubreddit}
          >
            Add Subreddit
          </Button>
          <IconButton onClick={loadSubreddits}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <GroupsIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {Array.isArray(subreddits) ? subreddits.length : 0}
                  </Typography>
                  <Typography color="text.secondary">
                    Total Subreddits
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
                    {Array.isArray(subreddits) ? subreddits.filter(s => s.is_active).length : 0}
                  </Typography>
                  <Typography color="text.secondary">
                    Active Monitoring
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
                  <SettingsIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {formatNumber(
                      Array.isArray(subreddits) ? subreddits.reduce((sum, s) => 
                        sum + (s.performance_metrics?.total_posts_processed || 0), 0
                      ) : 0
                    )}
                  </Typography>
                  <Typography color="text.secondary">
                    Posts Processed
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
                  <TrendingUpIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {Array.isArray(subreddits) && subreddits.length > 0 
                      ? (subreddits.reduce((sum, s) => 
                          sum + (s.performance_metrics?.accuracy_rate || 0), 0
                        ) / subreddits.length).toFixed(1)
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
      </Grid>

      {/* Subreddits Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📊 Configured Subreddits
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Subreddit</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="center">Subscribers</TableCell>
                  <TableCell align="center">Posts Processed</TableCell>
                  <TableCell align="center">Accuracy Rate</TableCell>
                  <TableCell align="center">Quality Threshold</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Array.isArray(subreddits) && subreddits.map((subreddit) => (
                  <TableRow key={subreddit.name} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                          {subreddit.name.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold">
                            r/{subreddit.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {subreddit.display_name || subreddit.name}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    <TableCell align="center">
                      <FormControlLabel
                        control={
                          <Switch
                            checked={subreddit.is_active}
                            onChange={() => handleToggleSubreddit(subreddit.name)}
                            size="small"
                          />
                        }
                        label={
                          <Chip
                            label={subreddit.is_active ? 'Active' : 'Inactive'}
                            color={getStatusColor(subreddit.is_active)}
                            size="small"
                          />
                        }
                      />
                    </TableCell>

                    <TableCell align="center">
                      <Typography variant="body2">
                        {formatNumber(subreddit.subscribers)}
                      </Typography>
                    </TableCell>

                    <TableCell align="center">
                      <Typography variant="body2">
                        {formatNumber(subreddit.performance_metrics?.total_posts_processed || 0)}
                      </Typography>
                    </TableCell>

                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <Typography variant="body2">
                          {(subreddit.performance_metrics?.accuracy_rate || 0).toFixed(1)}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={subreddit.performance_metrics?.accuracy_rate || 0}
                          color={
                            (subreddit.performance_metrics?.accuracy_rate || 0) > 70 
                              ? 'success' 
                              : 'warning'
                          }
                          sx={{ width: 50, height: 4 }}
                        />
                      </Box>
                    </TableCell>

                    <TableCell align="center">
                      <Typography variant="body2">
                        {subreddit.config?.quality_threshold || 40}
                      </Typography>
                    </TableCell>

                    <TableCell align="center">
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                        <Tooltip title="Edit Configuration">
                          <IconButton 
                            size="small"
                            onClick={() => handleEditSubreddit(subreddit)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Subreddit">
                          <IconButton 
                            size="small"
                            color="error"
                            onClick={() => handleDeleteSubreddit(subreddit.name)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedSubreddit ? 'Edit Subreddit' : 'Add New Subreddit'}
        </DialogTitle>
        <DialogContent>
          {!selectedSubreddit && (
            <TextField
              autoFocus
              margin="dense"
              label="Subreddit Name"
              fullWidth
              variant="outlined"
              value={newSubredditName}
              onChange={(e) => setNewSubredditName(e.target.value)}
              placeholder="e.g., SecurityAnalysis"
              helperText="Enter subreddit name without 'r/' prefix"
            />
          )}
          
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Configuration options will be available here for setting quality thresholds, 
            post limits, and filtering criteria.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleSaveSubreddit}
            variant="contained"
            disabled={!selectedSubreddit && !newSubredditName.trim()}
          >
            {selectedSubreddit ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default SubredditManagement;
