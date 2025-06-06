/**
 * Server-Sent Events (SSE) service for real-time updates
 * This service establishes and manages an SSE connection to the backend
 */

import { API_BASE_URL } from './api';
import websocketService from './websocket';

// Define event types
export type SSEEventType = 'whatsapp-status' | 'chat-update' | 'analytics-update' | 'user-update';

// Define event listeners
type EventListener = (data: any) => void;
const listeners: Record<SSEEventType, EventListener[]> = {
  'whatsapp-status': [],
  'chat-update': [],
  'analytics-update': [],
  'user-update': []
};

// SSE connection
let eventSource: EventSource | null = null;

/**
 * Connect to the SSE endpoint
 */
const connect = () => {
  if (eventSource) {
    console.log('SSE connection already exists');
    return;
  }

  try {
    console.log('Connecting to SSE endpoint...');
    eventSource = new EventSource(`${API_BASE_URL}/sse`);

    eventSource.onopen = () => {
      console.log('SSE connection established');
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      disconnect();
      
      // Try to reconnect after 5 seconds
      setTimeout(() => {
        connect();
      }, 5000);
    };

    // Set up event listeners for different event types
    eventSource.addEventListener('whatsapp-status', (event) => {
      const data = JSON.parse(event.data);
      console.log('Received whatsapp-status event:', data);
      listeners['whatsapp-status'].forEach(listener => listener(data));
    });

    eventSource.addEventListener('chat-update', (event) => {
      const data = JSON.parse(event.data);
      console.log('Received chat-update event:', data);
      
      // Update last_interaction timestamp if this is a new message
      if (data && data.type === 'new_message' && data.sender) {
        console.log(`Updating last_interaction for user ${data.sender} from SSE chat-update`);
        
        // Emit a user_activity event to the WebSocket if available
        if (websocketService && websocketService.isConnected()) {
          // Emit user activity event to update last_interaction timestamp
          websocketService.emit('user_activity', {
            user_id: data.sender,
            activity_type: 'message',
            timestamp: new Date().toISOString()
          });
          
          // Also emit thread_update to trigger UI updates
          websocketService.emit('thread_update', {
            sender: data.sender,
            timestamp: new Date().toISOString(),
            type: 'new_message'
          });
        }
      }
      
      listeners['chat-update'].forEach(listener => listener(data));
    });

    eventSource.addEventListener('analytics-update', (event) => {
      const data = JSON.parse(event.data);
      console.log('Received analytics-update event:', data);
      listeners['analytics-update'].forEach(listener => listener(data));
    });

    eventSource.addEventListener('user-update', (event) => {
      const data = JSON.parse(event.data);
      console.log('Received user-update event:', data);
      listeners['user-update'].forEach(listener => listener(data));
    });

  } catch (error) {
    console.error('Failed to connect to SSE:', error);
  }
};

/**
 * Disconnect from the SSE endpoint
 */
const disconnect = () => {
  if (eventSource) {
    console.log('Closing SSE connection');
    eventSource.close();
    eventSource = null;
  }
};

/**
 * Add an event listener for a specific event type
 */
const addEventListener = (eventType: SSEEventType, callback: EventListener) => {
  listeners[eventType].push(callback);
  return () => removeEventListener(eventType, callback);
};

/**
 * Remove an event listener
 */
const removeEventListener = (eventType: SSEEventType, callback: EventListener) => {
  const index = listeners[eventType].indexOf(callback);
  if (index !== -1) {
    listeners[eventType].splice(index, 1);
  }
};

/**
 * Check if SSE is connected
 */
const isConnected = (): boolean => {
  return eventSource !== null && eventSource.readyState === EventSource.OPEN;
};

const sseService = {
  connect,
  disconnect,
  addEventListener,
  removeEventListener,
  isConnected
};

export default sseService;
