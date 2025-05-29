'use client';

import { useState, useEffect, useRef } from 'react';
import { Chat } from '@/types/chat';
import { fetchChatById, sendMessage, toggleBotStatus } from '@/services/api';
import { sendWhatsAppMessage } from '@/services/whatsappService';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { PaperAirplaneIcon, XCircleIcon, CheckCircleIcon, PhoneIcon } from '@heroicons/react/24/outline';
import websocketService from '@/services/websocket';

interface ConversationDetailProps {
  chat: Chat;
}

const ConversationDetail = ({ chat: initialChat }: ConversationDetailProps) => {
  const [chat, setChat] = useState<Chat>(initialChat);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [botEnabled, setBotEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Update chat state when initialChat prop changes
  useEffect(() => {
    console.log('initialChat changed:', initialChat.id);
    
    // Completely reset state when switching chats
    setChat(initialChat);
    setMessage('');
    setError(null);
    
    // Scroll to top of messages when switching chats
    setTimeout(() => {
      const messagesContainer = messagesEndRef.current?.parentElement;
      if (messagesContainer) {
        messagesContainer.scrollTop = 0;
      }
    }, 100);
    
    // Get bot status for the new chat
    const fetchBotStatus = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/admin/bot-status/${initialChat.id}`);
        const data = await response.json();
        if (response.ok && data.botEnabled !== undefined) {
          setBotEnabled(data.botEnabled);
        }
      } catch (err) {
        console.error('Error fetching bot status:', err);
        // Default to enabled if there's an error
        setBotEnabled(true);
      }
    };
    
    fetchBotStatus();
    
    // Fetch the latest chat data to ensure we have the most up-to-date information
    const fetchLatestChatData = async () => {
      try {
        const updatedChat = await fetchChatById(initialChat.id);
        setChat(updatedChat);
      } catch (err) {
        console.error('Error fetching latest chat data:', err);
      }
    };
    
    fetchLatestChatData();
  }, [initialChat]);

  // Set up WebSocket listeners for real-time updates
  useEffect(() => {
    if (!chat || !chat.id) return;
    
    console.log('Setting up WebSocket listeners for chat:', chat.id);
    
    // Ensure WebSocket connection is established
    websocketService.connect();
    
    // Define message handler function
    const handleNewMessage = (updatedChat: Chat) => {
      // Only update if this is the chat we're currently viewing
      if (updatedChat.id === chat.id) {
        console.log('🔴 Received new message via WebSocket for chat:', chat.id);
        console.log('Updated chat data:', updatedChat);
        
        console.log('Using WebSocket data directly for real-time updates');
        
        // Directly update the chat with the WebSocket data
        setChat(prevChat => {
          // Create a new chat object with the updated data
          const updatedChatObject = {
            ...prevChat,
            ...updatedChat,
            // Ensure these properties are updated
            lastMessage: updatedChat.lastMessage || prevChat.lastMessage,
            lastTimestamp: updatedChat.lastTimestamp || prevChat.lastTimestamp,
            // If updatedChat has messages, use them, otherwise keep the current messages
            messages: updatedChat.messages && updatedChat.messages.length > 0 
              ? updatedChat.messages 
              : prevChat.messages,
            // Reset unansweredCount when we receive a new message
            unansweredCount: updatedChat.unansweredCount === 0 ? undefined : updatedChat.unansweredCount
          };
          
          console.log('Updated chat object:', updatedChatObject);
          return updatedChatObject;
        });
        
        // Scroll to bottom when new message arrives
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    };
    
    // Define bot status handler function
    const handleBotStatusChange = ({ chatId, enabled }: { chatId: string, enabled: boolean }) => {
      if (chatId === chat.id) {
        console.log('🔴 Received bot status change via WebSocket:', enabled);
        setBotEnabled(enabled);
      }
    };
    
    // Subscribe to new messages for this specific chat
    websocketService.subscribeToNewMessages(handleNewMessage);
    
    // Subscribe to bot status changes
    websocketService.subscribeToBotStatusChange(handleBotStatusChange);
    
    // Clean up subscriptions when component unmounts or chat changes
    return () => {
      websocketService.unsubscribeFromNewMessages(handleNewMessage);
      websocketService.unsubscribeFromBotStatusChange(handleBotStatusChange);
    };
  }, [chat.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    try {
      setLoading(true);
      setError(null);
      
      // Format the recipient number correctly for WhatsApp
      // Remove the @s.whatsapp.net suffix if present
      const recipientNumber = chat.sender.replace('@s.whatsapp.net', '');
      
      // Send message via WhatsApp service
      try {
        // First try to send via WhatsApp service
        const whatsappResult = await sendWhatsAppMessage(recipientNumber, message);
        console.log('Message sent via WhatsApp service:', whatsappResult);
      } catch (whatsappError) {
        console.error('Error sending via WhatsApp service:', whatsappError);
        // If WhatsApp service fails, we'll still continue to log the message
      }

      // Log the message in our backend
      await sendMessage({
        recipient: chat.sender,
        message: message,
        useBot: botEnabled
      });

      // Clear input
      setMessage('');

      // Refresh chat data
      const updatedChat = await fetchChatById(chat.id);
      
      // Also update the unansweredCount to 0 since we just responded
      setChat({
        ...updatedChat,
        unansweredCount: 0
      });
      
      // Update the parent component's list if needed
      // This will be handled by the periodic refresh, but we can force it here for immediate feedback
      
      // Scroll to bottom to show the new message
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBotStatus = async () => {
    try {
      // Toggle bot status locally first for immediate UI feedback
      const newStatus = !botEnabled;
      setBotEnabled(newStatus);
      
      // Save this preference to the backend
      await toggleBotStatus(chat.id, newStatus);
    } catch (err) {
      console.error('Error toggling bot status:', err);
      // Revert change if there's an error
      setBotEnabled(botEnabled);
      setError('Failed to update bot status. Please try again.');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-white to-blue-50 flex justify-between items-center shadow-sm">
        <div className="flex items-center">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center mr-3 shadow-md">
            <span className="font-bold text-lg">
              {(chat.senderName || chat.sender || '?').charAt(0)}
            </span>
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-lg">{chat.senderName || 'Unknown'}</h2>
            <div className="flex items-center">
              <PhoneIcon className="h-3.5 w-3.5 text-gray-500 mr-1" />
              <p className="text-sm text-gray-500">{formatPhoneNumber(chat.sender)}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center">
          <button
            className={`flex items-center px-4 py-2 rounded-full text-sm font-medium mr-2 transition-all duration-200 shadow-sm ${
              botEnabled
                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700'
                : 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700'
            }`}
            onClick={handleToggleBotStatus}
          >
            {botEnabled ? (
              <>
                <CheckCircleIcon className="h-5 w-5 mr-1.5" />
                Bot Aktif
              </>
            ) : (
              <>
                <XCircleIcon className="h-5 w-5 mr-1.5" />
                Bot Nonaktif
              </>
            )}
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-5 bg-gradient-to-b from-blue-50 to-white">
        <div className="space-y-6">
          {chat.messages && chat.messages.map((message, index) => (
            <div 
              key={message.id || index} 
              className={`flex ${message.isFromUser ? 'justify-start' : 'justify-end'}`}
            >
              {/* Avatar untuk pesan user */}
              {message.isFromUser && (
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 text-white flex items-center justify-center mr-3 self-end shadow-md">
                  <span className="text-xs font-bold">
                    {chat.senderName?.charAt(0) || chat.sender.charAt(0)}
                  </span>
                </div>
              )}
              
              <div 
                className={`rounded-2xl px-5 py-3 max-w-[70%] break-words shadow-sm ${message.isFromUser 
                  ? 'bg-white border border-gray-100 text-gray-800' 
                  : 'bg-gradient-to-r from-green-500 to-green-600 text-white'}`}
              >
                <div className="text-sm">{message.content}</div>
                <div className={`text-xs mt-2 text-right ${message.isFromUser ? 'text-gray-500' : 'text-green-100'}`}>
                  {formatMessageTime(message.timestamp)}
                </div>
              </div>
              
              {/* Avatar untuk pesan admin/bot */}
              {!message.isFromUser && (
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-400 to-green-500 text-white flex items-center justify-center ml-3 self-end shadow-md">
                  <span className="text-xs font-bold">A</span>
                </div>
              )}
            </div>
          ))}
          
          {/* Jika tidak ada pesan, tampilkan pesan kosong */}
          {(!chat.messages || chat.messages.length === 0) && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="text-gray-400 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-lg font-medium">Belum ada percakapan</p>
                  <p className="text-sm">Pesan akan muncul di sini ketika pengguna mulai mengobrol</p>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="p-5 border-t border-gray-200 bg-gradient-to-b from-white to-gray-50 shadow-inner">
        {error && (
          <div className="mb-3 p-3 bg-red-50 text-red-600 rounded-lg shadow-sm border border-red-100 flex items-center">
            <XCircleIcon className="h-5 w-5 mr-2 text-red-500" />
            <span>{error}</span>
          </div>
        )}
        <div className="flex flex-col">
          <div className="bg-gradient-to-r from-green-50 to-green-100 p-3 rounded-t-xl border-t border-l border-r border-green-200 shadow-sm">
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-400 to-green-500 text-white flex items-center justify-center mr-3 shadow-md">
                <span className="text-xs font-bold">A</span>
              </div>
              <span className="text-sm font-medium text-green-800">Admin/CS</span>
              {botEnabled ? (
                <span className="ml-3 text-xs bg-gradient-to-r from-green-200 to-green-300 text-green-800 px-3 py-1 rounded-full shadow-sm">
                  <CheckCircleIcon className="h-3.5 w-3.5 inline mr-1" />
                  Bot Aktif
                </span>
              ) : (
                <span className="ml-3 text-xs bg-gradient-to-r from-red-200 to-red-300 text-red-800 px-3 py-1 rounded-full shadow-sm">
                  <XCircleIcon className="h-3.5 w-3.5 inline mr-1" />
                  Bot Nonaktif
                </span>
              )}
            </div>
          </div>
          
          <div className="relative border border-green-200 rounded-b-xl overflow-hidden shadow-md">
            {/* Membuat div yang menutupi seluruh area input untuk memperluas area klik */}
            <div 
              className="absolute inset-0 cursor-text" 
              onClick={() => {
                // Fokus ke input saat area di sekitar input diklik
                const inputElement = document.getElementById('message-input');
                if (inputElement) inputElement.focus();
              }}
            />
            
            <div className="flex items-center relative z-10">
              <input
                id="message-input"
                type="text"
                placeholder="Ketik balasan sebagai Admin/CS..."
                className="flex-1 px-5 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white w-full text-gray-700 placeholder-gray-400"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                disabled={loading}
              />
              <button
                className="px-5 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 relative z-20 transition-all duration-200 shadow-sm"
                onClick={handleSendMessage}
                disabled={loading || !message.trim()}
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="mt-3 text-xs flex items-center justify-center">
          <span className={`px-3 py-1.5 rounded-full ${botEnabled ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
            {botEnabled ? 'Bot akan merespons pesan berikutnya dari pengguna' : 'Bot tidak akan merespons (mode CS manual)'}
          </span>
        </div>
      </div>
    </div>
  );
};

// Helper function to format phone numbers from WhatsApp format
const formatPhoneNumber = (phoneNumber: string | undefined): string => {
  if (!phoneNumber) return 'Unknown';
  
  try {
    // Remove the WhatsApp prefix if present
    const cleaned = phoneNumber.replace('whatsapp:', '');
    
    // Format Indonesian numbers
    if (cleaned.startsWith('62')) {
      return `+${cleaned}`;
    }
    
    return cleaned;
  } catch (error) {
    console.error('Error formatting phone number:', error);
    return 'Unknown';
  }
};

// Helper function to format message timestamps
function formatMessageTime(timestamp: string | undefined): string {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    return format(date, 'HH:mm');
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return '';
  }
}

export default ConversationDetail;
