'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { PhoneIcon } from '@heroicons/react/24/outline';

interface Chat {
  id: string;
  sender: string;
  lastMessage: string;
  lastTimestamp: string;
}

interface Stats {
  totalChatsToday: number;
  totalChatsThisWeek: number;
  activeUsers: number;
  averageResponseTime: number;
}

export default function Home() {
  // Using static data to avoid API calls that might fail
  const staticChats: Chat[] = [
    {
      id: '1',
      sender: '6281234567890',
      lastMessage: 'Apa itu program 7 hari menuju sehat raga dan jiwa?',
      lastTimestamp: '2025-05-25T13:01:33Z'
    },
    {
      id: '2',
      sender: '6287654321098',
      lastMessage: 'Bagaimana cara mendaftar program ini?',
      lastTimestamp: '2025-05-25T12:45:22Z'
    },
    {
      id: '3',
      sender: '6282345678901',
      lastMessage: 'Berapa biaya untuk mengikuti program detoksifikasi?',
      lastTimestamp: '2025-05-25T11:30:15Z'
    }
  ];

  const staticStats: Stats = {
    totalChatsToday: 15,
    totalChatsThisWeek: 87,
    activeUsers: 42,
    averageResponseTime: 12
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 overflow-auto p-6">
        <h1 className="text-2xl font-bold mb-6">WhatsApp Chatbot Admin Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm text-gray-500 mb-1">Total Chats Today</h3>
            <p className="text-2xl font-bold">{staticStats.totalChatsToday}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm text-gray-500 mb-1">Total Chats This Week</h3>
            <p className="text-2xl font-bold">{staticStats.totalChatsThisWeek}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm text-gray-500 mb-1">Active Users</h3>
            <p className="text-2xl font-bold">{staticStats.activeUsers}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm text-gray-500 mb-1">Avg. Response Time</h3>
            <p className="text-2xl font-bold">{staticStats.averageResponseTime}s</p>
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Recent Conversations</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 text-gray-500">Sender</th>
                  <th className="text-left p-3 text-gray-500">Last Message</th>
                  <th className="text-left p-3 text-gray-500">Time</th>
                </tr>
              </thead>
              <tbody>
                {staticChats.map((chat) => (
                  <tr key={chat.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">{chat.sender}</td>
                    <td className="p-3">{chat.lastMessage}</td>
                    <td className="p-3">{new Date(chat.lastTimestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>WhatsApp Chatbot Admin Dashboard © 2025</p>
        </div>
      </div>
    </div>
  );
}
