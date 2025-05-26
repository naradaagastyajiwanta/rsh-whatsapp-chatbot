'use client';

import { useState, useEffect } from 'react';
import { fetchChats, searchChats } from '@/services/api';
import { Chat } from '@/types/chat';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { ExclamationCircleIcon } from '@heroicons/react/24/solid';

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
      
      const data = await (searchQuery ? searchChats(searchQuery) : fetchChats());
      
      // Process data to ensure unansweredCount is handled correctly
      const processedData = data.map(chat => {
        // Create a new chat object without the unansweredCount property
        const { unansweredCount, ...chatWithoutCount } = chat;
        
        // Only add unansweredCount back if it's greater than 0
        if (unansweredCount && unansweredCount > 0) {
          return { ...chatWithoutCount, unansweredCount };
        }
        
        return chatWithoutCount;
      });
      
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
  
  // Set up periodic refresh for chat list
  useEffect(() => {
    // Initial load
    loadChats();
    
    // Set up interval for periodic refresh (every 5 seconds)
    const intervalId = setInterval(() => {
      loadChats();
    }, 5000);
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
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
