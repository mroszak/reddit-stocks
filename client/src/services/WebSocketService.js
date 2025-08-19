import io from 'socket.io-client';

class WebSocketServiceClass {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.subscribers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  initialize() {
    if (this.socket) {
      // Already initialized
      if (!this.socket.connected) {
        this.socket.connect();
      }
      return;
    }

    const protocol = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'wss' : 'ws';
    const defaultUrl = (typeof window !== 'undefined')
      ? `${protocol}://${window.location.hostname}:5000`
      : 'http://localhost:5000';
    const wsUrl = process.env.REACT_APP_WS_URL || defaultUrl;
    console.log('🔌 Initializing WebSocket connection to:', wsUrl);

    this.socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    this.setupEventListeners();
  }

  setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.connected = true;
      this.reconnectAttempts = 0;
      this.notifySubscribers('connection', { status: 'connected' });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.connected = false;
      this.notifySubscribers('connection', { status: 'disconnected', reason });
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect - reconnect manually
        this.handleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      console.error('Error details:', {
        message: error.message,
        type: error.type,
        description: error.description,
        context: error.context,
        code: error.code
      });
      this.connected = false;
      this.handleReconnect();
    });

    // Real-time data events
    this.socket.on('stockUpdate', (data) => {
      this.notifySubscribers('stockUpdate', data);
    });

    this.socket.on('sentimentUpdate', (data) => {
      this.notifySubscribers('sentimentUpdate', data);
    });

    this.socket.on('trendingUpdate', (data) => {
      this.notifySubscribers('trendingUpdate', data);
    });

    this.socket.on('confidenceUpdate', (data) => {
      this.notifySubscribers('confidenceUpdate', data);
    });

    this.socket.on('subredditUpdate', (data) => {
      this.notifySubscribers('subredditUpdate', data);
    });

    this.socket.on('userUpdate', (data) => {
      this.notifySubscribers('userUpdate', data);
    });

    this.socket.on('processingUpdate', (data) => {
      this.notifySubscribers('processingUpdate', data);
    });

    this.socket.on('alertUpdate', (data) => {
      this.notifySubscribers('alertUpdate', data);
    });

    this.socket.on('systemHealth', (data) => {
      this.notifySubscribers('systemHealth', data);
    });
  }

  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.notifySubscribers('connection', { 
        status: 'failed', 
        message: 'Unable to reconnect to server' 
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      console.log(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      if (this.socket) {
        this.socket.connect();
      } else {
        console.error('❌ Socket is null, reinitializing...');
        this.initialize();
      }
    }, delay);
  }

  subscribe(event, callback, id = null) {
    const subscriptionId = id || `${event}_${Date.now()}_${Math.random()}`;
    
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Map());
    }
    
    this.subscribers.get(event).set(subscriptionId, callback);
    
    return subscriptionId;
  }

  unsubscribe(event, subscriptionId) {
    if (this.subscribers.has(event)) {
      this.subscribers.get(event).delete(subscriptionId);
      
      // Clean up empty event maps
      if (this.subscribers.get(event).size === 0) {
        this.subscribers.delete(event);
      }
    }
  }

  notifySubscribers(event, data) {
    if (this.subscribers.has(event)) {
      this.subscribers.get(event).forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in WebSocket subscriber for ${event}:`, error);
        }
      });
    }
  }

  // Join specific rooms for targeted updates
  joinStockRoom(ticker) {
    if (this.socket && this.connected) {
      this.socket.emit('joinStock', ticker);
    }
  }

  leaveStockRoom(ticker) {
    if (this.socket && this.connected) {
      this.socket.emit('leaveStock', ticker);
    }
  }

  joinSubredditRoom(subreddit) {
    if (this.socket && this.connected) {
      this.socket.emit('joinSubreddit', subreddit);
    }
  }

  leaveSubredditRoom(subreddit) {
    if (this.socket && this.connected) {
      this.socket.emit('leaveSubreddit', subreddit);
    }
  }

  // Request real-time updates
  requestStockUpdates(ticker) {
    if (this.socket && this.connected) {
      this.socket.emit('requestStockUpdates', ticker);
    }
  }

  requestTrendingUpdates() {
    if (this.socket && this.connected) {
      this.socket.emit('requestTrendingUpdates');
    }
  }

  requestProcessingUpdates() {
    if (this.socket && this.connected) {
      this.socket.emit('requestProcessingUpdates');
    }
  }

  // Send data to server
  emit(event, data) {
    if (this.socket && this.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('WebSocket not connected, cannot emit event:', event);
    }
  }

  // Connection status
  isConnected() {
    return this.connected && this.socket?.connected;
  }

  getStatus() {
    return {
      connected: this.connected,
      reconnectAttempts: this.reconnectAttempts,
      subscriberCount: Array.from(this.subscribers.values())
        .reduce((total, eventMap) => total + eventMap.size, 0)
    };
  }

  disconnect() {
    if (this.socket) {
      try {
        this.socket.removeAllListeners();
      } catch (_) {}
      if (this.socket.connected || this.socket.active) {
        this.socket.disconnect();
      }
      this.socket = null;
    }
    this.connected = false;
    this.subscribers.clear();
    this.reconnectAttempts = 0;
  }

  // Utility method for React components to easily subscribe/unsubscribe
  useSubscription(event, callback, dependencies = []) {
    return {
      subscribe: () => this.subscribe(event, callback),
      unsubscribe: (id) => this.unsubscribe(event, id)
    };
  }
}

// Create singleton instance
export const WebSocketService = new WebSocketServiceClass();
