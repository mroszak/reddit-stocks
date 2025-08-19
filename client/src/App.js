import React, { useState, useEffect } from 'react';
import { 
  ThemeProvider, 
  createTheme, 
  CssBaseline, 
  Box, 
  AppBar, 
  Toolbar, 
  Typography, 
  IconButton, 
  Container,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  Switch,
  FormControlLabel,
  Tooltip,
  Fade,
  Avatar,
  Stack
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Groups as GroupsIcon,
  Assessment as AssessmentIcon,
  Settings as SettingsIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon
} from '@mui/icons-material';

// Import our custom components
import Dashboard from './components/Dashboard';
import StockDetail from './components/StockDetail';
import SubredditManagement from './components/SubredditManagement';
import UserReputation from './components/UserReputation';
import { ApiService } from './services/ApiService';
import { WebSocketService } from './services/WebSocketService';

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : true; // Default to dark mode for trading interface
  });
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [railHovered, setRailHovered] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedStock, setSelectedStock] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);

  // Create enhanced professional theme
  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: '#00C851', // Robinhood green
        dark: '#00A045',
        light: '#4FD683',
        contrastText: '#FFFFFF'
      },
      secondary: {
        main: '#FF4757', // Clean red
        dark: '#E84142',
        light: '#FF6B7A',
        contrastText: '#FFFFFF'
      },
      background: {
        default: darkMode ? '#0B0B0F' : '#F8F9FA',
        paper: darkMode ? '#1A1A1F' : '#FFFFFF',
        surface: darkMode ? '#252530' : '#F1F3F4'
      },
      text: {
        primary: darkMode ? '#FFFFFF' : '#1C1E21',
        secondary: darkMode ? '#B0B3B8' : '#65676B',
        disabled: darkMode ? '#65676B' : '#BDC1C6'
      },
      divider: darkMode ? '#2E2E38' : '#DADCE0',
      success: {
        main: '#00C851',
        dark: '#00A045',
        light: '#4FD683'
      },
      error: {
        main: '#FF4757',
        dark: '#E84142',
        light: '#FF6B7A'
      },
      warning: {
        main: '#FFA726',
        dark: '#F57C00',
        light: '#FFB74D'
      },
      info: {
        main: '#42A5F5',
        dark: '#1976D2',
        light: '#64B5F6'
      }
    },
    typography: {
      fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
      h1: {
        fontSize: '2.5rem',
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: '-0.02em'
      },
      h2: {
        fontSize: '2rem',
        fontWeight: 600,
        lineHeight: 1.3,
        letterSpacing: '-0.01em'
      },
      h3: {
        fontSize: '1.75rem',
        fontWeight: 600,
        lineHeight: 1.3
      },
      h4: {
        fontSize: '1.5rem',
        fontWeight: 600,
        lineHeight: 1.4
      },
      h5: {
        fontSize: '1.25rem',
        fontWeight: 600,
        lineHeight: 1.4
      },
      h6: {
        fontSize: '1.125rem',
        fontWeight: 600,
        lineHeight: 1.4
      },
      subtitle1: {
        fontSize: '1rem',
        fontWeight: 500,
        lineHeight: 1.5
      },
      subtitle2: {
        fontSize: '0.875rem',
        fontWeight: 500,
        lineHeight: 1.57
      },
      body1: {
        fontSize: '1rem',
        fontWeight: 400,
        lineHeight: 1.5
      },
      body2: {
        fontSize: '0.875rem',
        fontWeight: 400,
        lineHeight: 1.43
      },
      caption: {
        fontSize: '0.75rem',
        fontWeight: 400,
        lineHeight: 1.66
      },
      overline: {
        fontSize: '0.75rem',
        fontWeight: 500,
        lineHeight: 2.66,
        textTransform: 'uppercase',
        letterSpacing: '0.08em'
      }
    },
    shape: {
      borderRadius: 12
    },
    breakpoints: {
      values: {
        xs: 0,
        sm: 600,
        md: 960,
        lg: 1280,
        xl: 1920,
        trading: 1400
      }
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            fontFeatureSettings: '"cv11", "ss01"',
            fontVariationSettings: '"opsz" 32'
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
        variants: [
          {
            props: { variant: 'trading' },
            style: {
              background: darkMode 
                ? 'linear-gradient(135deg, #1A1A1F 0%, #252530 100%)'
                : 'linear-gradient(135deg, #FFFFFF 0%, #F8F9FA 100%)',
              backdropFilter: 'blur(20px)',
              border: darkMode 
                ? '1px solid rgba(255,255,255,0.05)'
                : '1px solid rgba(0,0,0,0.05)',
              boxShadow: darkMode
                ? '0 8px 32px rgba(0,0,0,0.3)'
                : '0 8px 32px rgba(0,0,0,0.1)'
            }
          }
        ]
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: darkMode
                ? '0 12px 40px rgba(0,0,0,0.4)'
                : '0 12px 40px rgba(0,0,0,0.15)'
            }
          }
        },
        variants: [
          {
            props: { variant: 'metric' },
            style: {
              background: darkMode 
                ? 'linear-gradient(135deg, #1A1A1F 0%, #252530 100%)'
                : 'linear-gradient(135deg, #FFFFFF 0%, #F8F9FA 100%)',
              border: darkMode 
                ? '1px solid rgba(255,255,255,0.08)'
                : '1px solid rgba(0,0,0,0.08)',
              backdropFilter: 'blur(20px)'
            }
          }
        ]
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
            borderRadius: 8,
            padding: '8px 16px',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          },
          contained: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              transform: 'translateY(-1px)'
            }
          }
        }
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 500,
            borderRadius: 6
          }
        }
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: darkMode 
              ? '1px solid rgba(255,255,255,0.08)'
              : '1px solid rgba(0,0,0,0.08)',
            padding: '16px'
          },
          head: {
            fontWeight: 600,
            fontSize: '0.875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }
        }
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            border: 'none'
          }
        }
      }
    }
  });

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    // Initialize services
    ApiService.initialize();
    WebSocketService.initialize();
    
    // Check system health
    checkSystemHealth();

    // Cleanup on unmount
    return () => {
      // In development, React StrictMode will double-invoke effects
      // This can cause a spurious "WebSocket closed before established" error
      // The connection actually works fine on the second mount
      if (process.env.NODE_ENV === 'development') {
        // Delay disconnect slightly to avoid the error message
        setTimeout(() => WebSocketService.disconnect(), 0);
      } else {
        WebSocketService.disconnect();
      }
    };
  }, []);

  const checkSystemHealth = async () => {
    try {
      const health = await ApiService.getSystemHealth();
      setSystemHealth(health);
    } catch (error) {
      console.error('Failed to check system health:', error);
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleNavigation = (view, stockTicker = null) => {
    setCurrentView(view);
    if (stockTicker) {
      setSelectedStock(stockTicker);
    }
    setDrawerOpen(false);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { id: 'subreddits', label: 'Subreddit Manager', icon: <GroupsIcon /> },
    { id: 'users', label: 'User Reputation', icon: <AssessmentIcon /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon /> }
  ];

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onStockSelect={(ticker) => handleNavigation('stock', ticker)} />;
      case 'stock':
        return <StockDetail ticker={selectedStock} onBack={() => handleNavigation('dashboard')} />;
      case 'subreddits':
        return <SubredditManagement />;
      case 'users':
        return <UserReputation />;
      case 'settings':
        return (
          <Container maxWidth="md" sx={{ mt: 4 }}>
            <Typography variant="h4" gutterBottom>Settings</Typography>
            <FormControlLabel
              control={<Switch checked={darkMode} onChange={toggleDarkMode} />}
              label="Dark Mode"
            />
          </Container>
        );
      default:
        return <Dashboard onStockSelect={(ticker) => handleNavigation('stock', ticker)} />;
    }
  };

  const railWidth = railHovered ? 240 : 72;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh' }}>
        {/* Navigation Rail */}
        <Drawer
          variant="permanent"
          sx={{
            width: railWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: railWidth,
              boxSizing: 'border-box',
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              background: theme.palette.background.paper,
              borderRight: `1px solid ${theme.palette.divider}`,
              overflow: 'hidden'
            },
          }}
          onMouseEnter={() => setRailHovered(true)}
          onMouseLeave={() => setRailHovered(false)}
        >
          {/* Logo/Brand Section */}
          <Box sx={{ 
            height: 80, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: railHovered ? 'flex-start' : 'center',
            px: railHovered ? 3 : 2,
            borderBottom: `1px solid ${theme.palette.divider}`
          }}>
            <Avatar 
              sx={{ 
                bgcolor: 'primary.main', 
                width: 40, 
                height: 40,
                mr: railHovered ? 2 : 0
              }}
            >
              📈
            </Avatar>
            <Fade in={railHovered} timeout={200}>
              <Typography variant="h6" sx={{ 
                fontWeight: 700,
                display: railHovered ? 'block' : 'none',
                whiteSpace: 'nowrap'
              }}>
                Reddit Stocks
              </Typography>
            </Fade>
          </Box>

          {/* Navigation Items */}
          <List sx={{ pt: 2, px: 1 }}>
            {menuItems.map((item) => (
              <Tooltip 
                key={item.id}
                title={!railHovered ? item.label : ''}
                placement="right"
                arrow
              >
                <ListItem disablePadding sx={{ mb: 1 }}>
                  <ListItemButton
                    onClick={() => handleNavigation(item.id)}
                    selected={currentView === item.id}
                    sx={{
                      minHeight: 48,
                      justifyContent: railHovered ? 'initial' : 'center',
                      px: 2.5,
                      borderRadius: 2,
                      mx: 1,
                      '&.Mui-selected': {
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        '&:hover': {
                          bgcolor: 'primary.dark',
                        },
                        '& .MuiListItemIcon-root': {
                          color: 'primary.contrastText',
                        }
                      },
                      '&:hover': {
                        bgcolor: 'action.hover',
                      }
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 0,
                        mr: railHovered ? 3 : 'auto',
                        justifyContent: 'center',
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <Fade in={railHovered} timeout={200}>
                      <ListItemText 
                        primary={item.label} 
                        sx={{ 
                          opacity: railHovered ? 1 : 0,
                          display: railHovered ? 'block' : 'none'
                        }} 
                      />
                    </Fade>
                  </ListItemButton>
                </ListItem>
              </Tooltip>
            ))}
          </List>

          {/* Bottom Section */}
          <Box sx={{ 
            position: 'absolute', 
            bottom: 0, 
            left: 0, 
            right: 0, 
            p: 2,
            borderTop: `1px solid ${theme.palette.divider}`
          }}>
            {/* System Status */}
            {systemHealth && (
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: railHovered ? 'flex-start' : 'center',
                mb: 2,
                px: 1
              }}>
                <Box 
                  sx={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: '50%', 
                    backgroundColor: systemHealth.status === 'healthy' ? 'success.main' : 'error.main',
                    mr: railHovered ? 1 : 0
                  }} 
                />
                <Fade in={railHovered} timeout={200}>
                  <Typography variant="caption" sx={{ 
                    display: railHovered ? 'block' : 'none',
                    color: 'text.secondary'
                  }}>
                    {systemHealth.status === 'healthy' ? 'System Online' : 'System Issues'}
                  </Typography>
                </Fade>
              </Box>
            )}

            {/* Dark Mode Toggle */}
            <Tooltip 
              title={!railHovered ? 'Toggle Theme' : ''}
              placement="right"
              arrow
            >
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: railHovered ? 'flex-start' : 'center'
              }}>
                {railHovered ? (
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={darkMode} 
                        onChange={toggleDarkMode} 
                        size="small" 
                      />
                    }
                    label="Dark Mode"
                    sx={{ m: 0 }}
                  />
                ) : (
                  <IconButton 
                    onClick={toggleDarkMode}
                    size="small"
                    sx={{ 
                      color: 'text.secondary',
                      '&:hover': {
                        color: 'primary.main'
                      }
                    }}
                  >
                    {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
                  </IconButton>
                )}
              </Box>
            </Tooltip>
          </Box>
        </Drawer>

        {/* Main Content */}
        <Box 
          component="main" 
          sx={{ 
            flexGrow: 1, 
            overflow: 'auto',
            background: theme.palette.background.default,
            minHeight: '100vh'
          }}
        >
          {/* Top Bar for Mobile */}
          <AppBar 
            position="sticky" 
            elevation={0}
            sx={{ 
              display: { xs: 'block', md: 'none' },
              bgcolor: 'background.paper',
              color: 'text.primary',
              borderBottom: `1px solid ${theme.palette.divider}`
            }}
          >
            <Toolbar>
              <IconButton
                color="inherit"
                aria-label="open drawer"
                onClick={toggleDrawer}
                edge="start"
                sx={{ mr: 2 }}
              >
                <MenuIcon />
              </IconButton>
              <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                Reddit Stocks
              </Typography>
              <IconButton color="inherit" onClick={toggleDarkMode}>
                {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Toolbar>
          </AppBar>

          {/* Mobile Drawer */}
          <Drawer
            variant="temporary"
            open={drawerOpen}
            onClose={toggleDrawer}
            ModalProps={{
              keepMounted: true,
            }}
            sx={{
              display: { xs: 'block', md: 'none' },
              '& .MuiDrawer-paper': {
                width: 280,
                boxSizing: 'border-box',
              },
            }}
          >
            <Box sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
                  📈
                </Avatar>
                <Typography variant="h6" fontWeight={700}>
                  Reddit Stocks
                </Typography>
              </Stack>
              
              <List>
                {menuItems.map((item) => (
                  <ListItem key={item.id} disablePadding sx={{ mb: 1 }}>
                    <ListItemButton
                      onClick={() => handleNavigation(item.id)}
                      selected={currentView === item.id}
                      sx={{
                        borderRadius: 2,
                        '&.Mui-selected': {
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                          '& .MuiListItemIcon-root': {
                            color: 'primary.contrastText',
                          }
                        }
                      }}
                    >
                      <ListItemIcon>{item.icon}</ListItemIcon>
                      <ListItemText primary={item.label} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
              
              <Divider sx={{ my: 3 }} />
              
              <FormControlLabel
                control={<Switch checked={darkMode} onChange={toggleDarkMode} />}
                label="Dark Mode"
              />
            </Box>
          </Drawer>

          {renderCurrentView()}
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;