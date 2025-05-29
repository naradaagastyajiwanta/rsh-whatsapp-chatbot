'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { UserAnalytics, UserData } from '../types/analytics';
import { ThreadMessage } from '../types/thread';
import { fetchAnalyticsUsers } from '../services/analyticsService';
import { fetchThreadMessages } from '../services/threadService';
import Sidebar from './Sidebar';
import CircularProgress from '@mui/material/CircularProgress';
import websocketService from '../services/websocket';

interface UserCardProps {
  phoneNumber: string;
  userData: UserData;
  onClick: () => void;
  isSelected: boolean;
}

const UserCard: React.FC<UserCardProps> = ({ phoneNumber, userData, onClick, isSelected }) => {
  const displayName = userData.details.name || phoneNumber.split('@')[0];
  const lastInteraction = new Date(userData.last_interaction || userData.first_interaction);
  const healthComplaints = userData.details.health_complaints || [];
  const barriers = userData.details.conversion_barriers || [];
  
  return (
    <div 
      className={`p-4 mb-4 rounded-lg shadow cursor-pointer transition-all ${
        isSelected ? 'bg-blue-50 border-2 border-blue-500' : 'bg-white hover:bg-gray-50'
      }`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold">{displayName}</h3>
          <p className="text-sm text-gray-500">{phoneNumber.split('@')[0]}</p>
        </div>
        <div className="text-xs text-gray-500">
          Last active: {format(lastInteraction, 'dd MMM yyyy HH:mm')}
        </div>
      </div>
      
      {userData.details.gender && (
        <div className="mt-2 text-sm">
          <span className="font-medium">Gender:</span> {userData.details.gender === 'male' ? 'Laki-laki' : 'Perempuan'}
        </div>
      )}
      
      {userData.details.age && (
        <div className="mt-1 text-sm">
          <span className="font-medium">Age:</span> {userData.details.age}
        </div>
      )}
      
      {healthComplaints.length > 0 && (
        <div className="mt-2">
          <p className="text-sm font-medium">Health Complaints:</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {healthComplaints.map((complaint, index) => (
              <span 
                key={index}
                className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full"
              >
                {complaint}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {barriers.length > 0 && (
        <div className="mt-2">
          <p className="text-sm font-medium">Conversion Barriers:</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {barriers.map((barrier, index) => (
              <span 
                key={index}
                className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full"
              >
                {barrier}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface ThreadViewProps {
  phoneNumber: string;
  messages: ThreadMessage[];
  isLoading: boolean;
}

const ThreadView: React.FC<ThreadViewProps> = ({ phoneNumber, messages, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <CircularProgress />
      </div>
    );
  }
  
  if (!messages || messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-16 w-16 text-gray-400 mb-4" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5} 
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
          />
        </svg>
        <h3 className="text-lg font-medium text-gray-600">No Thread Messages</h3>
        <p className="text-gray-500 text-center mt-2">
          No OpenAI Assistant thread messages found for this user.
        </p>
      </div>
    );
  }
  
  // Sort messages by creation time (newest first)
  const sortedMessages = [...messages].sort((a, b) => b.created_at - a.created_at);
  
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-4 pb-2 border-b">
        <h2 className="text-xl font-semibold">Thread Messages</h2>
        <p className="text-sm text-gray-500">
          {phoneNumber.split('@')[0]} - {sortedMessages.length} messages
        </p>
      </div>
      
      <div className="space-y-4">
        {sortedMessages.map((message) => {
          const isUser = message.role === 'user';
          
          // Safely extract message content
          let messageContent = '';
          try {
            if (message.content && Array.isArray(message.content)) {
              // Find the first text content
              const textContent = message.content.find(item => 
                item.type === 'text' && item.text && item.text.value
              );
              
              if (textContent && textContent.text) {
                messageContent = textContent.text.value;
              } else {
                // Fallback: try to get content directly if structure is different
                messageContent = JSON.stringify(message.content);
              }
            } else if (typeof message.content === 'string') {
              // Handle case where content might be a string directly
              messageContent = message.content;
            }
          } catch (err) {
            console.error('Error parsing message content:', err);
            messageContent = 'Error displaying message content';
          }
          
          const messageDate = new Date(message.created_at * 1000);
          
          return (
            <div 
              key={message.id}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[75%] rounded-lg p-3 ${
                  isUser 
                    ? 'bg-blue-500 text-white rounded-tr-none' 
                    : 'bg-gray-100 text-gray-800 rounded-tl-none'
                }`}
              >
                <div className="text-sm mb-1 font-medium">
                  {isUser ? 'User' : 'Assistant'}
                </div>
                <div className="whitespace-pre-wrap">{messageContent}</div>
                <div className={`text-xs mt-1 text-right ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>
                  {format(messageDate, 'dd MMM yyyy HH:mm')}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Users: React.FC = () => {
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics>({} as UserAnalytics);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  
  // Function to fetch user analytics data
  const fetchUserData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const userData = await fetchAnalyticsUsers();
      console.log('Fetched user analytics data:', userData);
      
      if (userData && userData.users) {
        setUserAnalytics(userData);
      } else {
        setError('Failed to fetch user data');
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError('Failed to fetch user data');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to fetch thread messages for a selected user
  const fetchUserThreadMessages = async (phoneNumber: string) => {
    try {
      setIsLoadingThread(true);
      
      const threadData = await fetchThreadMessages(phoneNumber);
      console.log('Fetched thread messages:', threadData);
      
      setThreadMessages(threadData.messages || []);
    } catch (err) {
      console.error('Error fetching thread messages:', err);
    } finally {
      setIsLoadingThread(false);
    }
  };
  
  // Handle user selection
  const handleUserSelect = (phoneNumber: string) => {
    setSelectedUser(phoneNumber);
    fetchUserThreadMessages(phoneNumber);
  };
  
  // Initial data fetch
  useEffect(() => {
    fetchUserData();
    
    // Set up WebSocket for real-time updates
    const setupWebSocket = () => {
      websocketService.connect();
      
      websocketService.on('analytics_update', (data: any) => {
        if (data.type === 'users') {
          console.log('Received user analytics update via WebSocket');
          setUserAnalytics(data.data);
        }
      });
      
      return () => {
        websocketService.disconnect();
      };
    };
    
    const cleanup = setupWebSocket();
    return cleanup;
  }, []);
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <CircularProgress />
        </div>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-red-50 p-6 rounded-lg text-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-12 w-12 text-red-500 mx-auto mb-4" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
            <h3 className="text-lg font-medium text-red-800">{error}</h3>
            <button 
              onClick={fetchUserData}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Get users data
  const users = userAnalytics.users || {};
  const userPhoneNumbers = Object.keys(users);
  
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          <div className="bg-white p-4 shadow-sm">
            <h1 className="text-2xl font-bold">Users</h1>
            <p className="text-gray-500">
              {userPhoneNumbers.length} total users
            </p>
          </div>
          
          <div className="flex-1 overflow-hidden flex">
            {/* Left panel - User list */}
            <div className="w-1/3 p-4 overflow-y-auto border-r">
              <div className="mb-4">
                <button 
                  onClick={fetchUserData}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center justify-center"
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-4 w-4 mr-2" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                    />
                  </svg>
                  Refresh Users
                </button>
              </div>
              
              {userPhoneNumbers.length === 0 ? (
                <div className="text-center p-6 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">No users found</p>
                </div>
              ) : (
                userPhoneNumbers.map((phoneNumber) => (
                  <UserCard 
                    key={phoneNumber}
                    phoneNumber={phoneNumber}
                    userData={users[phoneNumber]}
                    onClick={() => handleUserSelect(phoneNumber)}
                    isSelected={selectedUser === phoneNumber}
                  />
                ))
              )}
            </div>
            
            {/* Right panel - Thread messages */}
            <div className="w-2/3 overflow-hidden">
              {selectedUser ? (
                <ThreadView 
                  phoneNumber={selectedUser}
                  messages={threadMessages}
                  isLoading={isLoadingThread}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-16 w-16 text-gray-400 mb-4" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={1.5} 
                      d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" 
                    />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-600">Select a User</h3>
                  <p className="text-gray-500 mt-2">
                    Select a user from the list to view their OpenAI Assistant thread messages.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Users;
