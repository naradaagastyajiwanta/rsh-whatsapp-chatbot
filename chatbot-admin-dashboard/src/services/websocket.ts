// Socket.IO service for real-time updates
import { Chat } from '@/types/chat';
import { PerformanceMetrics, UserAnalytics } from '@/types/analytics';
import { WhatsAppServiceStatus } from '@/services/whatsappService';
import { io, Socket } from 'socket.io-client';

type SocketCallback = (data: any) => void;
type ConnectionStatusCallback = (isConnected: boolean) => void;

class SocketIOService {
  private socket: Socket | null = null;
  private connectionStatusCallbacks: ConnectionStatusCallback[] = [];
  private url: string;
  private newMessageCallbacks: ((chat: Chat) => void)[] = [];
  private chatsUpdateCallbacks: ((chats: Chat[]) => void)[] = [];
  private botStatusChangeCallbacks: ((data: { chatId: string, enabled: boolean }) => void)[] = [];
  private analyticsPerformanceCallbacks: ((data: PerformanceMetrics) => void)[] = [];
  private analyticsUsersCallbacks: ((data: UserAnalytics) => void)[] = [];
  private whatsappStatusCallbacks: ((data: WhatsAppServiceStatus) => void)[] = [];
  private customEventCallbacks: Map<string, SocketCallback[]> = new Map();
  private reconnectInterval: NodeJS.Timeout | null = null;
  private connectionAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor() {
    // Use environment variable or default to localhost for development
    let baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    
    // Ensure we're using the correct protocol (http/https) without WebSocket protocol
    if (baseUrl.startsWith('wss://')) {
      baseUrl = 'https://' + baseUrl.substring(6);
    } else if (baseUrl.startsWith('ws://')) {
      baseUrl = 'http://' + baseUrl.substring(5);
    }
    
    this.url = baseUrl;
    console.log('Initializing Socket.IO with URL:', this.url);
    // Log all environment variables for debugging
    console.log('Environment variables:', {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      NEXT_PUBLIC_WEBSOCKET_URL: process.env.NEXT_PUBLIC_WEBSOCKET_URL
    });
    // Connect immediately on initialization
    this.connect();
  }

  connect() {
    if (this.socket && this.socket.connected) {
      console.log('Socket.IO already connected');
      return;
    }

    // Clear any existing reconnect interval
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    try {
      console.log('Connecting to Socket.IO server at:', this.url);
      // Normalize URL to ensure it doesn't have trailing slash
      const normalizedUrl = this.url.endsWith('/') ? this.url.slice(0, -1) : this.url;
      console.log('Normalized WebSocket URL:', normalizedUrl);
      
      // Gunakan konfigurasi yang lebih sederhana untuk Socket.IO
      this.socket = io(normalizedUrl, {
        transports: ['polling'],  // Gunakan polling saja untuk menghindari masalah CORS dengan WebSocket
        path: '/socket.io',
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
        withCredentials: false,  // Ubah ke false untuk menghindari masalah CORS
        autoConnect: true
      });

      // Set up event listeners
      this.socket.on('connect', () => {
        console.log('🟢 Socket.IO connected successfully!');
        this.connectionAttempts = 0;
        this.notifyConnectionStatus(true);
        
        // Re-subscribe to all events after reconnection
        console.log('Subscribing to chats...');
        this.socket?.emit('subscribe_to_chats');
        
        // Set up event handlers for all message types
        this.setupEventHandlers();
      });

      this.socket.on('disconnect', () => {
        console.log('🔴 Socket.IO disconnected');
        this.notifyConnectionStatus(false);
        this.attemptReconnect();
      });

      this.socket.on('connect_error', (error) => {
        console.error('🔴 Socket.IO connection error:', error);
        this.attemptReconnect();
      });

      // Initial subscription to server events
      console.log('Initial subscription to chats...');
      this.socket.emit('subscribe_to_chats');
    } catch (error) {
      console.error('Failed to connect to Socket.IO:', error);
      this.attemptReconnect();
    }
  }
  
  private setupEventHandlers() {
    if (!this.socket) return;
    
    // Remove any existing listeners to prevent duplicates
    this.socket.off('new_message');
    this.socket.off('chats_update');
    this.socket.off('bot_status_change');
    this.socket.off('analytics:performance');
    this.socket.off('analytics:users');
    this.socket.off('whatsapp_status');
    this.socket.off('user_activity');
    this.socket.off('thread_update');
    this.socket.off('analytics_update');
    
    // Set up new listeners with more detailed logging
    this.socket.on('new_message', (data: Chat) => {
      console.log('🟡 Received new_message event:', data);
      console.log(`Chat ID: ${data.id}, Last Message: ${data.lastMessage}`);
      
      // Emit a special event to update user's last_interaction timestamp
      if (data.sender) {
        console.log(`Emitting user_activity event for ${data.sender}`);
        this.socket?.emit('user_activity', {
          user_id: data.sender,
          activity_type: 'message',
          timestamp: new Date().toISOString()
        });
        
        // Also emit thread_update to trigger UI updates
        this.socket?.emit('thread_update', {
          sender: data.sender,
          timestamp: new Date().toISOString(),
          type: 'new_message'
        });
      }
      
      if (this.newMessageCallbacks.length === 0) {
        console.warn('No callbacks registered for new_message events');
      } else {
        console.log(`Notifying ${this.newMessageCallbacks.length} subscribers about new message`);
        this.newMessageCallbacks.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error('Error in new_message callback:', error);
          }
        });
      }
    });
    
    this.socket.on('chats_update', (data: Chat[]) => {
      console.log('🟡 Received chats_update event with', data.length, 'chats');
      
      if (this.chatsUpdateCallbacks.length === 0) {
        console.warn('No callbacks registered for chats_update events');
      } else {
        console.log(`Notifying ${this.chatsUpdateCallbacks.length} subscribers about chats update`);
        this.chatsUpdateCallbacks.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error('Error in chats_update callback:', error);
          }
        });
      }
    });
    
    this.socket.on('bot_status_change', (data: { chatId: string, enabled: boolean }) => {
      console.log('🟡 Received bot_status_change event:', data);
      
      if (this.botStatusChangeCallbacks.length === 0) {
        console.warn('No callbacks registered for bot_status_change events');
      } else {
        console.log(`Notifying ${this.botStatusChangeCallbacks.length} subscribers about bot status change`);
        this.botStatusChangeCallbacks.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error('Error in bot_status_change callback:', error);
          }
        });
      }
    });

    // Analytics performance event handler
    this.socket.on('analytics:performance', (data: PerformanceMetrics) => {
      console.log('🟡 Received analytics:performance event:', data);
      
      if (this.analyticsPerformanceCallbacks.length === 0) {
        console.warn('No callbacks registered for analytics:performance events');
      } else {
        console.log(`Notifying ${this.analyticsPerformanceCallbacks.length} subscribers about analytics performance update`);
        this.analyticsPerformanceCallbacks.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error('Error in analytics:performance callback:', error);
          }
        });
      }
    });

    // Analytics users event handler
    this.socket.on('analytics:users', (data: UserAnalytics) => {
      console.log('🟡 Received analytics:users event:', data);
      
      if (this.analyticsUsersCallbacks.length === 0) {
        console.warn('No callbacks registered for analytics:users events');
      } else {
        console.log(`Notifying ${this.analyticsUsersCallbacks.length} subscribers about analytics users update`);
        this.analyticsUsersCallbacks.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error('Error in analytics:users callback:', error);
          }
        });
      }
    });
    
    // User activity event handler - for real-time last active updates
    this.socket.off('user_activity');
    this.socket.on('user_activity', (data: any) => {
      console.log('🟡 Received user_activity event:', data);
      
      // Jika ada user_id, update last_interaction timestamp
      if (data && data.user_id) {
        console.log(`Processing user activity for ${data.user_id}`);
        
        // Trigger local update untuk last_interaction timestamp
        this.emitLocalUserActivityUpdate(data.user_id, data.timestamp || new Date().toISOString());
        
        // Notifikasi semua subscribers
        this.notifyEventSubscribers('user_activity', data);
      }
    });
    
    // Thread update event handler
    this.socket.on('thread_update', (data: any) => {
      console.log('🟡 Received thread_update event:', data);
      
      // Notify all subscribers with this event
      this.notifyEventSubscribers('thread_update', data);
    });
    
    // WhatsApp status event handler
    this.socket.on('whatsapp_status', (data: WhatsAppServiceStatus) => {
      console.log('🟡 Received whatsapp_status event:', data);
      
      if (this.whatsappStatusCallbacks.length === 0) {
        console.warn('No callbacks registered for whatsapp_status events');
      } else {
        console.log(`Notifying ${this.whatsappStatusCallbacks.length} subscribers about WhatsApp status update`);
        this.whatsappStatusCallbacks.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error('Error in whatsapp_status callback:', error);
          }
        });
      }
    });
    
    // This section is now handled in the user_activity event handler above
    
    // Set up custom event handlers for other events
    this.customEventCallbacks.forEach((callbacks, eventName) => {
      // Skip user_activity since we already set it up above
      if (eventName === 'user_activity') return;
      
      if (this.socket) {
        this.socket.off(eventName); // Remove existing handler
        this.socket.on(eventName, (data: any) => {
          console.log(`🟡 Received custom event ${eventName}:`, data);
          
          if (callbacks.length === 0) {
            console.warn(`No callbacks registered for ${eventName} events`);
          } else {
            console.log(`Notifying ${callbacks.length} subscribers about ${eventName} update`);
            callbacks.forEach(callback => {
              try {
                callback(data);
              } catch (error) {
                console.error(`Error in ${eventName} callback:`, error);
              }
            });
          }
        });
      }
    });
  }
  
  private attemptReconnect() {
    if (this.connectionAttempts >= this.maxReconnectAttempts) {
      console.error(`Maximum reconnection attempts (${this.maxReconnectAttempts}) reached. Giving up.`);
      return;
    }
    
    this.connectionAttempts++;
    
    // Clear any existing reconnect interval
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
    
    const delay = Math.min(30000, Math.pow(2, this.connectionAttempts) * 1000); // Exponential backoff
    console.log(`Attempting to reconnect in ${delay / 1000} seconds...`);
    
    this.reconnectInterval = setInterval(() => {
      console.log(`Reconnection attempt ${this.connectionAttempts}...`);
      this.connect();
    }, delay);
  }
  
  private notifyConnectionStatus(isConnected: boolean) {
    this.connectionStatusCallbacks.forEach(callback => {
      try {
        callback(isConnected);
      } catch (error) {
        console.error('Error in connection status callback:', error);
      }
    });
  }
  
  // Register a callback for connection status changes
  onConnectionStatusChange(callback: ConnectionStatusCallback) {
    this.connectionStatusCallbacks.push(callback);
    
    // Immediately notify of current status
    if (this.socket) {
      callback(this.socket.connected);
    } else {
      callback(false);
    }
  }
  
  // Disconnect from the Socket.IO server
  disconnect() {
    if (this.socket) {
      console.log('Disconnecting from Socket.IO server...');
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.connectionStatusCallbacks = [];
    this.newMessageCallbacks = [];
    this.chatsUpdateCallbacks = [];
    this.botStatusChangeCallbacks = [];
    this.analyticsPerformanceCallbacks = [];
    this.analyticsUsersCallbacks = [];
    this.whatsappStatusCallbacks = [];
    this.customEventCallbacks.clear();
  }
  
  // Check if socket is connected
  isConnected(): boolean {
    return this.socket !== null && this.socket.connected;
  }
  
  // Method to emit events to the server
  emit(eventName: string, data?: any) {
    if (this.socket && this.socket.connected) {
      console.log(`Emitting ${eventName} event:`, data || {});
      this.socket.emit(eventName, data);
      
      // Special handling for user_activity events to update last_interaction locally
      if (eventName === 'user_activity' && data && data.user_id) {
        // Trigger a local update for the user's last_interaction timestamp
        this.emitLocalUserActivityUpdate(data.user_id, data.timestamp || new Date().toISOString());
      }
      
      return true;
    } else {
      console.warn(`Cannot emit ${eventName} event: socket not connected`);
      return false;
    }
  }
  
  // WebSocket event handling methods

  // Register callbacks for new message events
  subscribeToNewMessages(callback: (chat: Chat) => void) {
    if (!this.socket) {
      this.connect();
    }
    
    // Store callback in our array for direct access
    this.newMessageCallbacks.push(callback);
    
    console.log(`Subscribed to new messages. Total subscribers: ${this.newMessageCallbacks.length}`);
  }
  
  unsubscribeFromNewMessages(callback: (chat: Chat) => void) {
    this.newMessageCallbacks = this.newMessageCallbacks.filter(cb => cb !== callback);
    console.log(`Unsubscribed from new messages. Remaining subscribers: ${this.newMessageCallbacks.length}`);
  }
  
  // Register callbacks for chats update events
  subscribeToChatsUpdate(callback: (chats: Chat[]) => void) {
    if (!this.socket) {
      this.connect();
    }
    
    // Store callback in our array for direct access
    this.chatsUpdateCallbacks.push(callback);
    
    // Force a subscription to chats
    if (this.socket && this.socket.connected) {
      console.log('Subscribing to chats updates...');
      this.socket.emit('subscribe_to_chats');
    }
    
    console.log(`Subscribed to chats updates. Total subscribers: ${this.chatsUpdateCallbacks.length}`);
  }
  
  unsubscribeFromChatsUpdate(callback: (chats: Chat[]) => void) {
    this.chatsUpdateCallbacks = this.chatsUpdateCallbacks.filter(cb => cb !== callback);
    console.log(`Unsubscribed from chats updates. Remaining subscribers: ${this.chatsUpdateCallbacks.length}`);
  }
  
  // Register callbacks for bot status change events
  subscribeToBotStatusChange(callback: (data: { chatId: string, enabled: boolean }) => void) {
    if (!this.socket) {
      this.connect();
    }
    
    // Store callback in our array for direct access
    this.botStatusChangeCallbacks.push(callback);
    
    console.log(`Subscribed to bot status change. Total subscribers: ${this.botStatusChangeCallbacks.length}`);
  }
  
  unsubscribeFromBotStatusChange(callback: (data: { chatId: string, enabled: boolean }) => void) {
    this.botStatusChangeCallbacks = this.botStatusChangeCallbacks.filter(cb => cb !== callback);
    console.log(`Unsubscribed from bot status change. Remaining subscribers: ${this.botStatusChangeCallbacks.length}`);
  }
  
  // Analytics methods
  subscribeToAnalyticsPerformance(callback: (data: PerformanceMetrics) => void) {
    if (!this.socket) {
      this.connect();
    }
    
    this.analyticsPerformanceCallbacks.push(callback);
    console.log(`Registered new analytics performance callback. Total: ${this.analyticsPerformanceCallbacks.length}`);
    
    // Subscribe to analytics events if not already subscribed
    if (this.socket?.connected) {
      console.log('Explicitly requesting analytics data via WebSocket (performance subscription)');
      this.socket.emit('subscribe_to_analytics');
      
      // Also request specific performance metrics
      this.socket.emit('get_performance_metrics');
    }
  }
  
  unsubscribeFromAnalyticsPerformance(callback: (data: PerformanceMetrics) => void) {
    this.analyticsPerformanceCallbacks = this.analyticsPerformanceCallbacks.filter(cb => cb !== callback);
    console.log(`Unregistered analytics performance callback. Remaining: ${this.analyticsPerformanceCallbacks.length}`);
  }
  
  subscribeToAnalyticsUsers(callback: (data: UserAnalytics) => void) {
    if (!this.socket) {
      this.connect();
    }
    
    this.analyticsUsersCallbacks.push(callback);
    console.log(`Registered new analytics users callback. Total: ${this.analyticsUsersCallbacks.length}`);
    
    // Subscribe to analytics events if not already subscribed
    if (this.socket?.connected) {
      console.log('Explicitly requesting analytics data via WebSocket (users subscription)');
      this.socket.emit('subscribe_to_analytics');
      
      // Also request specific user analytics
      this.socket.emit('get_user_analytics');
    }
  }
  
  unsubscribeFromAnalyticsUsers(callback: (data: UserAnalytics) => void) {
    this.analyticsUsersCallbacks = this.analyticsUsersCallbacks.filter(cb => cb !== callback);
    console.log(`Unregistered analytics users callback. Remaining: ${this.analyticsUsersCallbacks.length}`);
  }
  
  // Request fresh analytics data from the server
  requestAnalyticsUpdate() {
    if (this.socket?.connected) {
      console.log('Requesting fresh analytics data from server');
      this.socket.emit('get_performance_metrics');
      this.socket.emit('get_user_analytics');
      return true;
    } else {
      console.warn('Cannot request analytics update: socket not connected');
      return false;
    }
  }
  
  // Register callbacks for WhatsApp status updates
  subscribeToWhatsAppStatus(callback: (data: WhatsAppServiceStatus) => void) {
    if (!this.socket) {
      this.connect();
    }
    
    this.whatsappStatusCallbacks.push(callback);
    console.log(`Registered new WhatsApp status callback. Total: ${this.whatsappStatusCallbacks.length}`);
    
    // Subscribe to WhatsApp status events if not already subscribed
    if (this.socket?.connected) {
      this.socket.emit('subscribe_to_whatsapp_status');
    }
  }
  
  unsubscribeFromWhatsAppStatus(callback: (data: WhatsAppServiceStatus) => void) {
    this.whatsappStatusCallbacks = this.whatsappStatusCallbacks.filter(cb => cb !== callback);
    console.log(`Unregistered WhatsApp status callback. Remaining: ${this.whatsappStatusCallbacks.length}`);
  }
  
  // Generic event subscription methods
  on(eventName: string, callback: SocketCallback): void {
    if (!this.socket) {
      this.connect();
    }
    
    // Add to custom event callbacks map
    if (!this.customEventCallbacks.has(eventName)) {
      this.customEventCallbacks.set(eventName, []);
      
      // Add socket listener if this is the first subscription to this event
      if (this.socket) {
        this.socket.on(eventName, (data: any) => {
          console.log(`🟡 Received custom event ${eventName}:`, data);
          
          const callbacks = this.customEventCallbacks.get(eventName) || [];
          if (callbacks.length === 0) {
            console.warn(`No callbacks registered for ${eventName} events`);
          } else {
            console.log(`Notifying ${callbacks.length} subscribers about ${eventName} update`);
            callbacks.forEach(cb => {
              try {
                cb(data);
              } catch (error) {
                console.error(`Error in ${eventName} callback:`, error);
              }
            });
          }
        });
      }
    }
    
    const callbacks = this.customEventCallbacks.get(eventName) || [];
    callbacks.push(callback);
    this.customEventCallbacks.set(eventName, callbacks);
    
    console.log(`Subscribed to custom event ${eventName}. Total subscribers: ${callbacks.length}`);
  }
  
  off(eventName: string, callback: SocketCallback): void {
    if (this.customEventCallbacks.has(eventName)) {
      const callbacks = this.customEventCallbacks.get(eventName) || [];
      const filteredCallbacks = callbacks.filter(cb => cb !== callback);
      
      if (filteredCallbacks.length === 0) {
        // Remove socket listener if no more callbacks for this event
        if (this.socket) {
          this.socket.off(eventName);
        }
        this.customEventCallbacks.delete(eventName);
        console.log(`Removed all subscribers for custom event ${eventName}`);
      } else {
        this.customEventCallbacks.set(eventName, filteredCallbacks);
        console.log(`Unsubscribed from custom event ${eventName}. Remaining subscribers: ${filteredCallbacks.length}`);
      }
    }
  }
  
  /**
   * Emits a local user activity update to update the last_interaction timestamp
   * @param userId The user ID
   * @param timestamp The timestamp of the activity
   */
  emitLocalUserActivityUpdate(userId: string, timestamp: string) {
    console.log(`Emitting local user activity update for ${userId} at ${timestamp}`);
    
    // Create a synthetic analytics_update event to update last_interaction locally
    const updateData = {
      type: 'user_insight_update',
      data: {
        sender: userId,
        details: {
          last_interaction: timestamp
        }
      }
    };
    
    // Notify subscribers of analytics_update event
    this.notifyEventSubscribers('analytics_update', updateData);
    
    // Also notify user_activity subscribers directly
    const activityData = {
      user_id: userId,
      timestamp: timestamp,
      activity_type: 'activity'
    };
    this.notifyEventSubscribers('user_activity', activityData);
  }
  
  // Notify all subscribers for a specific event
  private notifyEventSubscribers(eventName: string, data: any) {
    const callbacks = this.customEventCallbacks.get(eventName);
    if (callbacks && callbacks.length > 0) {
      console.log(`Notifying ${callbacks.length} subscribers for event: ${eventName}`);
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${eventName} callback:`, error);
        }
      });
    } else {
      console.log(`No subscribers for event: ${eventName}`);
    }
  }
}

// Create a singleton instance
const websocketService = new SocketIOService();

export default websocketService;
