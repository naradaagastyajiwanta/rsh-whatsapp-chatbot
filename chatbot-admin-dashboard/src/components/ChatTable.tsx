'use client';

import { useState, useEffect } from 'react';
import { fetchChats, searchChats } from '@/services/api';
import { Chat } from '@/types/chat';
import { format } from 'date-fns';
import { id as idLocale, enUS } from 'date-fns/locale';
import { useLanguage } from '@/context/LanguageContext';

interface ChatTableProps {
  searchQuery: string;
  onChatSelect: (chat: Chat) => void;
}

const ChatTable = ({ searchQuery, onChatSelect }: ChatTableProps) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t, language } = useLanguage();

  useEffect(() => {
    const loadChats = async () => {
      try {
        setLoading(true);
        const data = await (searchQuery ? searchChats(searchQuery) : fetchChats());
        setChats(data);
        setError(null);
      } catch (err) {
        setError(t('common.failedToLoadData'));
        console.error('Error loading chats:', err);
      } finally {
        setLoading(false);
      }
    };

    loadChats();
  }, [searchQuery]);

  if (loading) {
    return (
      <div className="overflow-hidden rounded-lg border border-gray-200 shadow-md bg-white p-4 animate-pulse">
        <div className="h-10 bg-gray-200 rounded-lg mb-4 w-full"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="flex items-center space-x-4">
              <div className="h-10 w-10 rounded-full bg-gray-200"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
              <div className="h-3 bg-gray-200 rounded w-1/6"></div>
              <div className="h-8 w-20 bg-gray-200 rounded-md"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="overflow-hidden rounded-lg border border-red-200 shadow-md bg-red-50 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-red-800">{t('common.errorLoadingData')}</h3>
        </div>
        <div className="text-red-600 mb-4 bg-red-100 p-3 rounded-md border border-red-200">{error}</div>
        <button 
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow transition-all duration-200 transform hover:-translate-y-1 flex items-center justify-center"
          onClick={() => window.location.reload()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {t('common.retry')}
        </button>
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg shadow-md bg-white">
        <div className="text-center p-8">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-700 mb-2">
            {searchQuery 
              ? t('conversations.noMatchingConversations').replace('{query}', searchQuery)
              : t('conversations.noConversationsAvailable')
            }
          </h3>
          <p className="text-gray-500">
            {searchQuery 
              ? t('conversations.tryDifferentKeywords')
              : t('conversations.newConversationsWillAppear')
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg shadow-md bg-white">
      <table className="w-full border-collapse bg-white text-left text-sm text-gray-500">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-4 font-medium text-gray-900">{t('conversations.sender')}</th>
            <th scope="col" className="px-6 py-4 font-medium text-gray-900">{t('conversations.lastMessage')}</th>
            <th scope="col" className="px-6 py-4 font-medium text-gray-900">{t('conversations.time')}</th>
            <th scope="col" className="px-6 py-4 font-medium text-gray-900">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 border-t border-gray-100">
          {chats.map((chat) => (
            <tr 
              key={chat.id} 
              className="hover:bg-gray-50 cursor-pointer"
              onClick={() => onChatSelect(chat)}
            >
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <span className="font-bold">
                      {chat.senderName?.charAt(0) || chat.sender.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-700">{chat.senderName || t('common.unknown')}</div>
                    <div className="text-xs text-gray-400">{formatPhoneNumber(chat.sender)}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="max-w-xs truncate">{chat.lastMessage}</div>
              </td>
              <td className="px-6 py-4">
                {formatTimestamp(chat.lastTimestamp)}
              </td>
              <td className="px-6 py-4">
                <button 
                  className="rounded bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChatSelect(chat);
                  }}
                >
                  {t('common.view')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-6 py-4 text-center text-xs text-gray-500">
        {language === 'en' 
          ? `Showing ${chats.length} conversations` 
          : `Menampilkan ${chats.length} percakapan`
        }
      </div>
    </div>
  );
};

// Helper function to format phone numbers from WhatsApp format
const formatPhoneNumber = (phoneNumber: string): string => {
  // Extract the phone number from the WhatsApp format (e.g., "6281234567890@s.whatsapp.net")
  const match = phoneNumber.match(/^(\d+)@/);
  if (!match) return phoneNumber;
  
  const number = match[1];
  // Format as +62 812-3456-7890
  if (number.startsWith('62')) {
    return `+${number.substring(0, 2)} ${number.substring(2, 5)}-${number.substring(5, 9)}-${number.substring(9)}`;
  }
  return number;
};

// Helper function to format timestamps
const formatTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    const { language, t } = useLanguage();
    const dateLocale = language === 'en' ? enUS : idLocale;
    
    if (diffInDays === 0) {
      // Today - show time only
      return format(date, "HH:mm");
    } else if (diffInDays === 1) {
      // Yesterday
      return (language === 'en' ? 'Yesterday ' : 'Kemarin ') + format(date, "HH:mm");
    } else if (diffInDays < 7) {
      // Within a week - show day name
      return format(date, "EEEE", { locale: dateLocale });
    } else {
      // More than a week ago - show full date
      return format(date, "d MMM yyyy", { locale: dateLocale });
    }
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    const { t } = useLanguage();
    return timestamp || t('common.invalidDate');
  }
};

export default ChatTable;
