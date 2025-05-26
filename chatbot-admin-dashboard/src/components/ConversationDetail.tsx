'use client';

import { useState, useEffect, useRef } from 'react';
import { Chat } from '@/types/chat';
import { fetchChatById, sendMessage, toggleBotStatus } from '@/services/api';
import { sendWhatsAppMessage } from '@/services/whatsappService';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { PaperAirplaneIcon, XCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

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

  // Refresh chat data periodically
  useEffect(() => {
    // Skip initial fetch as we already do it in the initialChat effect
    // Only set up periodic refresh
    const fetchChatData = async () => {
      try {
        console.log('Refreshing chat data for:', chat.id);
        const updatedChat = await fetchChatById(chat.id);
        
        // Preserve the current messages if the API returns empty messages
        // This prevents flickering or loss of messages during refresh
        if (updatedChat.messages && updatedChat.messages.length > 0) {
          setChat(updatedChat);
        } else if (updatedChat.messages && updatedChat.messages.length === 0 && chat.messages.length > 0) {
          // If API returns empty messages but we have messages, keep our messages
          setChat(prev => ({
            ...updatedChat,
            messages: prev.messages
          }));
        } else {
          setChat(updatedChat);
        }
      } catch (err) {
        console.error('Error refreshing chat:', err);
      }
    };

    // Set up interval for periodic refresh
    const intervalId = setInterval(fetchChatData, 10000); // Refresh every 10 seconds

    return () => clearInterval(intervalId);
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
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center">
          <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3">
            <span className="font-bold">
              {chat.senderName?.charAt(0) || chat.sender.charAt(0)}
            </span>
          </div>
          <div>
            <h2 className="font-bold text-gray-900">{chat.senderName || 'Unknown'}</h2>
            <p className="text-sm text-gray-500">{formatPhoneNumber(chat.sender)}</p>
          </div>
        </div>
        <div className="flex items-center">
          <button
            className={`flex items-center px-3 py-1 rounded-md text-sm font-medium mr-2 ${
              botEnabled
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-red-100 text-red-700 hover:bg-red-200'
            }`}
            onClick={handleToggleBotStatus}
          >
            {botEnabled ? (
              <>
                <CheckCircleIcon className="h-4 w-4 mr-1" />
                Bot Aktif
              </>
            ) : (
              <>
                <XCircleIcon className="h-4 w-4 mr-1" />
                Bot Nonaktif
              </>
            )}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
        <div className="space-y-4">
          {chat.messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isFromUser ? 'justify-start' : 'justify-end'}`}
            >
              {/* Tampilkan avatar untuk pesan pengguna */}
              {message.isFromUser && (
                <div className="h-8 w-8 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center mr-2 self-end">
                  <span className="text-xs font-bold">
                    {chat.senderName?.charAt(0) || chat.sender.charAt(0)}
                  </span>
                </div>
              )}
              
              <div
                className={`max-w-[75%] rounded-lg px-4 py-3 shadow-sm ${
                  message.isFromUser
                    ? 'bg-white border border-gray-200' // Pesan user (pengguna WhatsApp)
                    : 'bg-green-600 text-white'         // Pesan admin/chatbot (kita)
                }`}
              >
                <div className="text-sm">{message.content}</div>
                <div
                  className={`text-xs mt-1 ${
                    message.isFromUser ? 'text-gray-400' : 'text-green-200'
                  }`}
                >
                  {formatMessageTime(message.timestamp)}
                </div>
              </div>
              
              {/* Tampilkan avatar untuk pesan admin/chatbot */}
              {!message.isFromUser && (
                <div className="h-8 w-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center ml-2 self-end">
                  <span className="text-xs font-bold">A</span>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200">
        {error && (
          <div className="mb-2 p-2 bg-red-50 text-red-600 rounded-md text-sm">
            {error}
          </div>
        )}
        <div className="flex flex-col">
          <div className="bg-green-50 p-2 rounded-t-md border-t border-l border-r border-green-200">
            <div className="flex items-center">
              <div className="h-6 w-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-2">
                <span className="text-xs font-bold">A</span>
              </div>
              <span className="text-sm font-medium text-green-800">Admin/CS</span>
              {botEnabled ? (
                <span className="ml-2 text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">Bot Aktif</span>
              ) : (
                <span className="ml-2 text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded-full">Bot Nonaktif</span>
              )}
            </div>
          </div>
          
          <div className="flex items-center border border-green-200 rounded-b-md overflow-hidden">
            <input
              type="text"
              placeholder="Ketik balasan sebagai Admin/CS..."
              className="flex-1 px-4 py-2 focus:outline-none focus:ring-1 focus:ring-green-500 bg-white"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={loading}
            />
            <button
              className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-green-300"
              onClick={handleSendMessage}
              disabled={loading || !message.trim()}
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <div className="mt-2 text-xs text-gray-500 flex items-center">
          <span className={botEnabled ? 'text-green-600' : 'text-red-600'}>
            {botEnabled ? 'Bot akan merespons pesan berikutnya dari pengguna' : 'Bot tidak akan merespons (mode CS manual)'}
          </span>
        </div>
      </div>
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

// Helper function to format message timestamps
function formatMessageTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return format(date, 'HH:mm');
  } catch (e) {
    console.error('Error formatting message time:', e);
    return '';
  }
}

export default ConversationDetail;
