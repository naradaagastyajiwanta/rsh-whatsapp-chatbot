'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import ConversationList from '@/components/ConversationList';
import ConversationDetail from '@/components/ConversationDetail';
import { Chat } from '@/types/chat';

export default function ConversationsPage() {
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleChatSelect = (chat: Chat) => {
    // Reset selected chat first to force component unmount/remount
    setSelectedChat(null);
    
    // Use setTimeout to ensure the component is fully unmounted before setting new chat
    setTimeout(() => {
      setSelectedChat(chat);
    }, 50);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Conversation List */}
        <div className="w-1/3 border-r border-gray-200 bg-white overflow-y-auto">
          <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Percakapan</h1>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Cari percakapan..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <ConversationList 
              searchQuery={searchQuery} 
              onChatSelect={handleChatSelect} 
              selectedChatId={selectedChat?.id}
            />
          </div>
        </div>
        
        {/* Right panel - Conversation Detail */}
        <div className="w-2/3 bg-white overflow-hidden flex flex-col">
          {selectedChat ? (
            <ConversationDetail chat={selectedChat} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <h3 className="text-xl font-medium mb-2">Pilih percakapan</h3>
                <p>Pilih percakapan dari daftar untuk melihat detailnya</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
