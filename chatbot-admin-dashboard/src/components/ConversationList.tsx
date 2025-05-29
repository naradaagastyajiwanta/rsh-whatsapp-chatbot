'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { Chat } from '@/types/chat';
import { formatDistanceToNow, format } from 'date-fns';
import { id } from 'date-fns/locale';
import { fetchChats } from '@/services/api';
import { ExclamationCircleIcon } from '@heroicons/react/24/solid';
import websocketService from '@/services/websocket';

interface ConversationListProps {
  searchQuery: string;
  onChatSelect: (chat: Chat) => void;
  selectedChatId?: string;
}

const ConversationList = ({ searchQuery, onChatSelect, selectedChatId }: ConversationListProps) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to load chats
  const loadChats = async () => {
    try {
      // Only show loading indicator on initial load
      if (chats.length === 0) {
        setLoading(true);
      }
      
      console.log('Fetching chats...');
      // If search query is provided, filter chats client-side
      const data = await fetchChats();
      console.log('Received chat data:', data);
      
      const filteredData = searchQuery 
        ? data.filter(chat => 
            chat.senderName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            chat.sender?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            chat.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : data;
      
      console.log('Filtered data:', filteredData);
      
      // Process data to ensure unansweredCount is handled correctly
      const processedData = filteredData.map((chat: Chat) => {
        // Create a new chat object without the unansweredCount property
        const { unansweredCount, ...chatWithoutCount } = chat;
        
        // Only add unansweredCount back if it's greater than 0
        if (unansweredCount && unansweredCount > 0) {
          return { ...chatWithoutCount, unansweredCount };
        }
        
        return chatWithoutCount;
      });
      
      console.log('Processed data:', processedData);
      setChats(processedData);
      setError(null);
    } catch (err) {
      setError('Failed to load chat data. Please try again later.');
      console.error('Error loading chats:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Load chats when search query changes
  useEffect(() => {
    loadChats();
  }, [searchQuery]);
  
  // Set up WebSocket connection and listeners
  useEffect(() => {
    // Initial load from REST API
    loadChats();
    
    // Connect to WebSocket
    websocketService.connect();
    
    // Connection status handler function
    const handleConnectionStatus = (isConnected: boolean) => {
      console.log(`WebSocket connection status: ${isConnected ? 'connected' : 'disconnected'}`);
      
      if (!isConnected) {
        setError('WebSocket disconnected. Reconnecting...');
      } else {
        setError(null);
        // Reload chats when reconnected
        loadChats();
      }
    };
    
    // Register connection status handler
    websocketService.onConnectionStatusChange(handleConnectionStatus);
    
    // New message handler function
    const handleNewMessage = (updatedChat: Chat) => {
      console.log('🔴 Received new message via WebSocket:', updatedChat);
      console.log('Chat ID:', updatedChat.id, 'Last Message:', updatedChat.lastMessage);
      
      // Update the specific chat in the list
      setChats(prevChats => {
        // Check if the chat already exists in the list
        const existingChatIndex = prevChats.findIndex(chat => chat.id === updatedChat.id);
        
        if (existingChatIndex !== -1) {
          // Update existing chat
          console.log('Updating existing chat in the list');
          const updatedChats = [...prevChats];
          updatedChats[existingChatIndex] = {
            ...updatedChats[existingChatIndex],
            lastMessage: updatedChat.lastMessage,
            lastTimestamp: updatedChat.lastTimestamp,
            unansweredCount: updatedChat.unansweredCount
          };
          return updatedChats;
        } else {
          // Add new chat to the list
          console.log('Adding new chat to the list');
          return [updatedChat, ...prevChats];
        }
      });
    };
    
    // Chats update handler function
    const handleChatsUpdate = (chats: Chat[]) => {
      console.log('🔴 Received chats update via WebSocket:', chats);
      setChats(chats);
    };
    
    // Bot status handler function
    const handleBotStatusChange = ({ chatId, enabled }: { chatId: string, enabled: boolean }) => {
      console.log(`Bot status changed for chat ${chatId}: ${enabled ? 'enabled' : 'disabled'}`);
      
      // Update the specific chat's bot status
      setChats(prevChats => 
        prevChats.map(chat => 
          chat.id === chatId ? { ...chat, botEnabled: enabled } : chat
        )
      );
    };
    
    // Subscribe to events
    websocketService.subscribeToNewMessages(handleNewMessage);
    websocketService.subscribeToChatsUpdate(handleChatsUpdate);
    websocketService.subscribeToBotStatusChange(handleBotStatusChange);
    
    // Log WebSocket connection status
    console.log('WebSocket setup complete, waiting for real-time updates...');
    
    // Clean up subscriptions when component unmounts
    return () => {
      console.log('Cleaning up WebSocket subscriptions');
      // Unsubscribe from all events using the handler references
      websocketService.unsubscribeFromNewMessages(handleNewMessage);
      websocketService.unsubscribeFromChatsUpdate(handleChatsUpdate);
      websocketService.unsubscribeFromBotStatusChange(handleBotStatusChange);
      // Note: There's no explicit unsubscribe method for connection status in the updated service
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, index) => (
          <div key={index} className="flex items-center p-3 border-b border-gray-100 animate-pulse">
            <div className="h-10 w-10 rounded-full bg-gray-200 mr-3"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
            <div className="h-3 bg-gray-200 rounded w-16"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-md">
        <p className="font-medium">Error loading conversations</p>
        <p className="text-sm">{error}</p>
        <button 
          className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded-md text-sm hover:bg-red-200"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="text-center p-4 text-gray-500">
        {searchQuery 
          ? `No conversations matching "${searchQuery}"`
          : 'No conversations available'
        }
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {chats.map((chat) => (
        <div 
          key={chat.id}
          className={`p-3 flex items-center cursor-pointer hover:bg-gray-50 transition-colors ${
            chat.id === selectedChatId ? 'bg-blue-50' : ''
          } ${
            chat.botEnabled === false && chat.unansweredCount && chat.unansweredCount > 0 ? 'bg-red-50' : ''
          }`}
          onClick={() => onChatSelect(chat)}
        >
          <div className="relative mr-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <span className="font-bold">
                {chat.senderName?.charAt(0) || chat.sender.charAt(0)}
              </span>
            </div>
            
            {/* Notification badge for unanswered messages */}
            {chat.botEnabled === false && chat.unansweredCount && chat.unansweredCount > 0 && (
              <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                {chat.unansweredCount}
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline">
              <div className="flex items-center">
                <h3 className="font-medium text-gray-900 truncate">
                  {formatPhoneNumber(chat.sender)}
                </h3>
                
                {/* Bot status indicator */}
                {chat.botEnabled === false && (
                  <span className="ml-2 text-xs bg-red-200 text-red-800 px-1.5 py-0.5 rounded-full">
                    Bot Off
                  </span>
                )}
                
                {/* Unanswered message indicator */}
                {chat.botEnabled === false && chat.unansweredCount && chat.unansweredCount > 0 && (
                  <span className="ml-2 flex items-center text-xs text-red-600">
                    <ExclamationCircleIcon className="h-3 w-3 mr-0.5" />
                    {chat.unansweredCount} belum dijawab
                  </span>
                )}
              </div>
              
              <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                {formatTimestamp(chat.lastTimestamp)}
              </span>
            </div>
            <p className="text-sm text-gray-500 truncate">{chat.lastMessage}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// Helper function to format phone numbers from WhatsApp format
function formatPhoneNumber(phoneNumber: string): string {
  // Remove the "@s.whatsapp.net" suffix if present
  let formattedNumber = phoneNumber.replace('@s.whatsapp.net', '');
  
  // Format the number with spaces for readability
  if (formattedNumber.startsWith('62')) {
    // Indonesian number: 628123456789 -> +62 812 3456 789
    return '+' + formattedNumber.replace(/(\d{2})(\d{3})(\d{4})(\d{3})/, '$1 $2 $3 $4');
  }
  
  return formattedNumber;
}

// Helper function to format timestamps
function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Check if the date is today
    if (date >= today) {
      return format(date, 'HH:mm');
    }
    
    // Check if the date is yesterday
    if (date >= yesterday) {
      return 'Kemarin';
    }
    
    // Check if the date is within the last week
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    if (date >= lastWeek) {
      return format(date, 'EEEE', { locale: id });
    }
    
    // Otherwise, show the date
    return format(date, 'dd/MM/yyyy');
  } catch (e) {
    console.error('Error formatting timestamp:', e);
    return timestamp;
  }
}

export default ConversationList;
