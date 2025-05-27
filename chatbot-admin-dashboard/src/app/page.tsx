'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import StatsCards from '@/components/StatsCards';
import ChatTable from '@/components/ChatTable';
import ChatDetailModal from '@/components/ChatDetailModal';
import SearchBar from '@/components/SearchBar';
import { Chat } from '@/types/chat';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleChatSelect = (chat: Chat) => {
    setSelectedChat(chat);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 overflow-auto p-6">
        <h1 className="text-2xl font-bold mb-6">WhatsApp Chatbot Admin Dashboard</h1>
        
        {/* Analytics Cards */}
        <div className="mb-6">
          <StatsCards />
        </div>
        
        {/* Search Bar */}
        <div className="mb-6">
          <SearchBar onSearch={handleSearch} />
        </div>
        
        {/* Chat Table */}
        <div className="bg-white rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold p-4 border-b border-gray-200">Percakapan Terbaru</h2>
          <ChatTable searchQuery={searchQuery} onChatSelect={handleChatSelect} />
        </div>
        
        {/* Chat Detail Modal */}
        {selectedChat && (
          <ChatDetailModal 
            isOpen={isModalOpen} 
            onClose={handleCloseModal} 
            chat={selectedChat} 
          />
        )}
        
        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>WhatsApp Chatbot Admin Dashboard © 2025</p>
        </div>
      </div>
    </div>
  );
}
