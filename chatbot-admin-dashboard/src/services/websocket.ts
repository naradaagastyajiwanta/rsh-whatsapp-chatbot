// Socket.IO service for real-time updates
import { Chat } from '@/types/chat';
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
  private reconnectInterval: NodeJS.Timeout | null = null;
  private connectionAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor() {
    // Use environment variable or default to localhost for development
    this.url = process.env.NEXT_PUBLIC_SOCKETIO_URL || 'http://localhost:5001';
    console.log('Socket.IO URL:', this.url);
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
      this.socket = io(this.url, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        forceNew: true
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
    
    // Set up new listeners with more detailed logging
    this.socket.on('new_message', (data: Chat) => {
      console.log('🟡 Received new_message event:', data);
      console.log(`Chat ID: ${data.id}, Last Message: ${data.lastMessage}`);
      
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
  }
  
  private attemptReconnect() {
    if (this.reconnectInterval) return; // Already attempting to reconnect
    
    if (this.connectionAttempts >= this.maxReconnectAttempts) {
      console.error('Maximum reconnection attempts reached');
      return;
    }
    
    this.connectionAttempts++;
    console.log(`Attempting to reconnect (${this.connectionAttempts}/${this.maxReconnectAttempts})...`);
    
    this.reconnectInterval = setInterval(() => {
      if (this.socket?.connected) {
        // Already reconnected, clear interval
        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
        return;
      }
      
      console.log('Attempting to reconnect...');
      this.connect();
    }, 5000); // Try to reconnect every 5 seconds
  }

  onConnectionStatusChange(callback: ConnectionStatusCallback) {
    this.connectionStatusCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.connectionStatusCallbacks.indexOf(callback);
      if (index !== -1) {
        this.connectionStatusCallbacks.splice(index, 1);
      }
    };
  }

  private notifyConnectionStatus(isConnected: boolean) {
    this.connectionStatusCallbacks.forEach(callback => callback(isConnected));
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.connectionStatusCallbacks = [];
  }

  // Specific methods for our chat application
  subscribeToNewMessages(callback: (chat: Chat) => void) {
    if (!this.socket) {
      this.connect();
    }
    
    // Store callback in our array for direct access
    this.newMessageCallbacks.push(callback);
    
    console.log(`Subscribed to new messages. Total subscribers: ${this.newMessageCallbacks.length}`);
    
    // Return unsubscribe function
    return () => {
      const index = this.newMessageCallbacks.indexOf(callback);
      if (index !== -1) {
        this.newMessageCallbacks.splice(index, 1);
        console.log(`Unsubscribed from new messages. Remaining subscribers: ${this.newMessageCallbacks.length}`);
      }
    };
  }
  
  subscribeToChatsUpdate(callback: (chats: Chat[]) => void) {
    if (!this.socket) {
      this.connect();
    }
    
    // Store callback in our array for direct access
    this.chatsUpdateCallbacks.push(callback);
    
    console.log(`Subscribed to chats update. Total subscribers: ${this.chatsUpdateCallbacks.length}`);
    
    // Return unsubscribe function
    return () => {
      const index = this.chatsUpdateCallbacks.indexOf(callback);
      if (index !== -1) {
        this.chatsUpdateCallbacks.splice(index, 1);
        console.log(`Unsubscribed from chats update. Remaining subscribers: ${this.chatsUpdateCallbacks.length}`);
      }
    };
  }
  
  subscribeToBotStatusChange(callback: (data: { chatId: string, enabled: boolean }) => void) {
    if (!this.socket) {
      this.connect();
    }
    
    // Store callback in our array for direct access
    this.botStatusChangeCallbacks.push(callback);
    
    console.log(`Subscribed to bot status change. Total subscribers: ${this.botStatusChangeCallbacks.length}`);
    
    // Return unsubscribe function
    return () => {
      const index = this.botStatusChangeCallbacks.indexOf(callback);
      if (index !== -1) {
        this.botStatusChangeCallbacks.splice(index, 1);
        console.log(`Unsubscribed from bot status change. Remaining subscribers: ${this.botStatusChangeCallbacks.length}`);
      }
    };
  }
}

// Create a singleton instance
const websocketService = new SocketIOService();

export default websocketService;
