import React from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Tooltip,
  Chip,
  LinearProgress
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material';

function ConfidenceIndicator({ 
  value, 
  size = 'medium', 
  variant = 'circular',
  showLabel = false,
  showIcon = true,
  detailed = false 
}) {
  const confidence = Math.max(0, Math.min(100, value || 0));
  
  const getConfidenceLevel = (conf) => {
    if (conf >= 85) return { level: 'Very High', color: 'success', icon: CheckCircleIcon };
    if (conf >= 70) return { level: 'High', color: 'info', icon: InfoIcon };
    if (conf >= 50) return { level: 'Medium', color: 'warning', icon: WarningIcon };
    if (conf >= 30) return { level: 'Low', color: 'warning', icon: WarningIcon };
    return { level: 'Very Low', color: 'error', icon: ErrorIcon };
  };

  const confidenceInfo = getConfidenceLevel(confidence);
  const IconComponent = confidenceInfo.icon;

  const getCircularSize = () => {
    switch (size) {
      case 'small': return 24;
      case 'large': return 56;
      default: return 40;
    }
  };

  const getTypographyVariant = () => {
    switch (size) {
      case 'small': return 'caption';
      case 'large': return 'h6';
      default: return 'body2';
    }
  };

  if (variant === 'linear') {
    return (
      <Box sx={{ width: '100%', minWidth: size === 'small' ? 60 : 100 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          {showIcon && (
            <IconComponent 
              color={confidenceInfo.color} 
              sx={{ 
                mr: 1, 
                fontSize: size === 'small' ? 16 : 20 
              }} 
            />
          )}
          {showLabel && (
            <Typography variant={getTypographyVariant()} color="text.secondary">
              Confidence
            </Typography>
          )}
        </Box>
        <LinearProgress
          variant="determinate"
          value={confidence}
          color={confidenceInfo.color}
          sx={{ 
            height: size === 'small' ? 4 : 6,
            borderRadius: 2,
            backgroundColor: 'rgba(0,0,0,0.1)'
          }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {confidence.toFixed(1)}%
          </Typography>
          {detailed && (
            <Typography variant="caption" color={`${confidenceInfo.color}.main`}>
              {confidenceInfo.level}
            </Typography>
          )}
        </Box>
      </Box>
    );
  }

  if (variant === 'chip') {
    return (
      <Chip
        icon={showIcon ? <IconComponent /> : undefined}
        label={showLabel ? `${confidence.toFixed(1)}% ${confidenceInfo.level}` : `${confidence.toFixed(1)}%`}
        color={confidenceInfo.color}
        size={size}
        variant="outlined"
      />
    );
  }

  // Default circular variant
  return (
    <Tooltip title={`Confidence: ${confidence.toFixed(1)}% (${confidenceInfo.level})`}>
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress
          variant="determinate"
          value={confidence}
          size={getCircularSize()}
          thickness={size === 'small' ? 6 : 4}
          color={confidenceInfo.color}
          sx={{
            circle: {
              strokeLinecap: 'round',
            }
          }}
        />
        <Box
          sx={{
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column'
          }}
        >
          {showIcon && size !== 'small' && (
            <IconComponent 
              color={confidenceInfo.color} 
              sx={{ fontSize: size === 'large' ? 20 : 16, mb: size === 'large' ? 0.5 : 0 }} 
            />
          )}
          <Typography
            variant={getTypographyVariant()}
            component="div"
            color="text.secondary"
            sx={{ fontWeight: 'bold', lineHeight: 1 }}
          >
            {confidence.toFixed(0)}%
          </Typography>
          {showLabel && size === 'large' && (
            <Typography
              variant="caption"
              component="div"
              color={`${confidenceInfo.color}.main`}
              sx={{ lineHeight: 1, mt: 0.5 }}
            >
              {confidenceInfo.level}
            </Typography>
          )}
        </Box>
      </Box>
    </Tooltip>
  );
}

export default ConfidenceIndicator;
