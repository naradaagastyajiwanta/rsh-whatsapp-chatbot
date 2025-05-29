import axios from 'axios';
import { ThreadResponse } from '../types/thread';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/**
 * Fetches thread messages for a specific user
 * @param sender The WhatsApp ID of the user (e.g., "6281234567890@s.whatsapp.net")
 * @returns Promise with thread messages
 */
export async function fetchThreadMessages(sender: string): Promise<ThreadResponse> {
  try {
    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();
    console.log(`Fetching thread messages for ${sender} from ${API_BASE_URL}/admin/threads/${sender}/messages`);
    
    // Try fetching both regular and analytics threads
    const regularPromise = axios.get(`${API_BASE_URL}/admin/threads/${sender}/messages`, {
      params: { timestamp },
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Content-Type': 'application/json'
      },
      timeout: 10000,
      withCredentials: true // Include credentials for CORS
    }).catch(err => {
      console.log('Regular thread fetch error:', err.message);
      return { data: { thread_id: '', messages: [] }, status: 404 };
    });
    
    const analyticsPrefix = 'analytics_';
    const analyticsSender = sender.includes(analyticsPrefix) ? sender : `${analyticsPrefix}${sender}`;
    
    const analyticsPromise = axios.get(`${API_BASE_URL}/admin/threads/${analyticsSender}/messages`, {
      params: { timestamp },
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Content-Type': 'application/json'
      },
      timeout: 10000,
      withCredentials: true // Include credentials for CORS
    }).catch(err => {
      console.log('Analytics thread fetch error:', err.message);
      return { data: { thread_id: '', messages: [] }, status: 404 };
    });
    
    // Wait for both requests to complete
    const [regularResponse, analyticsResponse] = await Promise.all([regularPromise, analyticsPromise]);
    
    console.log('Regular thread response status:', regularResponse.status);
    console.log('Regular thread messages count:', regularResponse.data.messages?.length || 0);
    console.log('Analytics thread response status:', analyticsResponse.status);
    console.log('Analytics thread messages count:', analyticsResponse.data.messages?.length || 0);
    
    // Combine messages from both threads
    const allMessages = [
      ...(regularResponse.data.messages || []),
      ...(analyticsResponse.data.messages || [])
    ];
    
    // Sort messages by creation time (newest first)
    allMessages.sort((a, b) => b.created_at - a.created_at);
    
    // Use the thread ID that has messages, or the regular one if both have messages
    const threadId = regularResponse.data.thread_id || analyticsResponse.data.thread_id || '';
    
    return {
      thread_id: threadId,
      messages: allMessages
    };
  } catch (error) {
    console.error('Error fetching thread messages:', error);
    // Return empty data on error
    return {
      thread_id: '',
      messages: []
    };
  }
}
