'use client';

import { useState, useEffect } from 'react';
import { fetchChats, searchChats } from '@/services/api';
import { Chat } from '@/types/chat';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface ChatTableProps {
  searchQuery: string;
  onChatSelect: (chat: Chat) => void;
}

const ChatTable = ({ searchQuery, onChatSelect }: ChatTableProps) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadChats = async () => {
      try {
        setLoading(true);
        const data = await (searchQuery ? searchChats(searchQuery) : fetchChats());
        setChats(data);
        setError(null);
      } catch (err) {
        setError('Failed to load chat data. Please try again later.');
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
          <h3 className="text-lg font-medium text-red-800">Error Loading Data</h3>
        </div>
        <div className="text-red-600 mb-4 bg-red-100 p-3 rounded-md border border-red-200">{error}</div>
        <button 
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow transition-all duration-200 transform hover:-translate-y-1 flex items-center justify-center"
          onClick={() => window.location.reload()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Retry
        </button>
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg shadow-md bg-white p-8">
        <div className="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-700 mb-2">
            {searchQuery 
              ? `Tidak ada percakapan yang cocok dengan "${searchQuery}"`
              : 'Belum ada data percakapan tersedia'
            }
          </h3>
          <p className="text-gray-500">
            {searchQuery 
              ? 'Coba gunakan kata kunci pencarian yang berbeda'
              : 'Percakapan baru akan muncul di sini saat pengguna mulai berinteraksi dengan chatbot'
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
      <table className="w-full border-collapse bg-white text-left text-sm text-gray-500">
        <thead className="bg-white">
          <tr>
            <th scope="col" className="px-6 py-4 font-medium text-blue-900">Pengguna</th>
            <th scope="col" className="px-6 py-4 font-medium text-blue-900">Pesan Terakhir</th>
            <th scope="col" className="px-6 py-4 font-medium text-blue-900">Waktu</th>
            <th scope="col" className="px-6 py-4 font-medium text-blue-900">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {chats.map((chat) => (
            <tr 
              key={chat.id} 
              className="hover:bg-blue-50 cursor-pointer transition-colors duration-150 animate-fadeIn"
              onClick={() => onChatSelect(chat)}
            >
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center shadow-md ring-2 ring-blue-200 ring-opacity-50">
                    <span className="font-bold">
                      {chat.senderName?.charAt(0) || chat.sender.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-700">{chat.senderName || 'Unknown'}</div>
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
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md shadow-sm transition-all duration-200 hover:shadow transform hover:-translate-y-1 flex items-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChatSelect(chat);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Lihat Detail
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // If it's today, show time only
    if (date.toDateString() === now.toDateString()) {
      return format(date, "'Hari ini,' HH:mm", { locale: id });
    }
    
    // If it's yesterday, show "Yesterday" and time
    if (date.toDateString() === yesterday.toDateString()) {
      return format(date, "'Kemarin,' HH:mm", { locale: id });
    }
    
    // Otherwise, show full date and time
    return format(date, "d MMMM yyyy, HH:mm", { locale: id });
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return timestamp;
  }
};

export default ChatTable;
