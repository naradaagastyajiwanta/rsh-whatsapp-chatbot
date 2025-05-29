'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { id as idLocale, enUS } from 'date-fns/locale';
import { UserAnalytics, UserData } from '../types/analytics';
import { ThreadMessage } from '../types/thread';
import { fetchAnalyticsUsers } from '../services/analyticsService';
import { fetchThreadMessages } from '../services/threadService';
import { getSelectedUser, setSelectedUser as saveSelectedUser } from '../services/userPreferencesService';
import Sidebar from './Sidebar';
import CircularProgress from '@mui/material/CircularProgress';
import websocketService from '../services/websocket';
import { useLanguage } from '../context/LanguageContext';

interface UserCardProps {
  phoneNumber: string;
  userData: UserData;
  onClick: () => void;
  isSelected: boolean;
}

const UserCard: React.FC<UserCardProps> = ({ phoneNumber, userData, onClick, isSelected }) => {
  const { t, language } = useLanguage();
  const displayName = userData.details.name || phoneNumber.split('@')[0];
  const lastInteraction = new Date(userData.details.last_interaction || userData.details.first_interaction);
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
          {t('analytics.lastActive')}: {format(lastInteraction, 'dd MMM yyyy HH:mm', { locale: language === 'id' ? idLocale : enUS })}
        </div>
      </div>
      
      {userData.details.gender && (
        <div className="mt-2 text-sm">
          <span className="font-medium">{t('analytics.gender')}:</span> {userData.details.gender === 'male' ? (language === 'en' ? 'Male' : 'Laki-laki') : (language === 'en' ? 'Female' : 'Perempuan')}
        </div>
      )}
      
      {userData.details.age && (
        <div className="mt-1 text-sm">
          <span className="font-medium">{t('analytics.age')}:</span> {userData.details.age}
        </div>
      )}
      
      {healthComplaints.length > 0 && (
        <div className="mt-2">
          <p className="text-sm font-medium">{t('analytics.complaints')}:</p>
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
          <p className="text-sm font-medium">{t('analytics.barriers')}:</p>
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
  onRefresh: (phoneNumber: string) => void;
}

const ThreadView: React.FC<ThreadViewProps> = ({ phoneNumber, messages, isLoading, onRefresh }) => {
  const { t } = useLanguage();
  
  // Handler untuk tombol refresh
  const handleRefreshClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onRefresh(phoneNumber);
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <CircularProgress />
      </div>
    );
  }
  
  // Sort messages by creation time (newest first)
  const sortedMessages = [...messages].sort((a, b) => b.created_at - a.created_at);
  
  return (
    <div className="h-full flex flex-col">
      {/* Header dengan tombol refresh */}
      <div className="bg-white p-4 shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">{phoneNumber}</h2>
          <p className="text-sm text-gray-500">
            {messages.length > 0 ? 
              t('conversations.messagesCount', { count: messages.length }) : 
              t('conversations.noMessages')}
          </p>
        </div>
        <button 
          onClick={handleRefreshClick}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
          disabled={isLoading}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-4 w-4 mr-1" 
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
          {t('common.refresh')}
        </button>
      </div>
      
      {/* Konten pesan */}
      <div className="flex-1 overflow-y-auto p-4">
        {!messages || messages.length === 0 ? (
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
            <h3 className="text-lg font-medium text-gray-600">{t('conversations.threadMessagesNotFound')}</h3>
            <p className="text-gray-500 text-center mt-2">
              {t('conversations.noMessagesDescription')}
            </p>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
};

const Users: React.FC = () => {
  const { t } = useLanguage();
  // Inisialisasi state dengan data dari localStorage jika ada
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics>(() => {
    try {
      const savedData = localStorage.getItem('userAnalytics');
      return savedData ? JSON.parse(savedData) : ({} as UserAnalytics);
    } catch (e) {
      console.error('Error loading userAnalytics from localStorage:', e);
      return {} as UserAnalytics;
    }
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Inisialisasi selectedUser sebagai null, akan diambil dari server
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  
  // Inisialisasi threadMessages dari localStorage berdasarkan selectedUser jika ada
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>(() => {
    try {
      if (selectedUser) {
        const cacheKey = `threadMessages_${selectedUser}`;
        const savedMessages = localStorage.getItem(cacheKey);
        if (savedMessages) return JSON.parse(savedMessages);
      }
      return [];
    } catch (e) {
      console.error('Error loading threadMessages from localStorage:', e);
      return [];
    }
  });
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  
  // Simpan data ke localStorage setiap kali berubah
  useEffect(() => {
    if (Object.keys(userAnalytics).length > 0 && userAnalytics.users) {
      try {
        console.log('Saving userAnalytics to localStorage:', userAnalytics);
        localStorage.setItem('userAnalytics', JSON.stringify(userAnalytics));
        localStorage.setItem('userAnalyticsLastFetch', new Date().getTime().toString());
      } catch (e) {
        console.error('Error saving userAnalytics to localStorage:', e);
      }
    }
  }, [userAnalytics]);
  
  // Simpan selectedUser ke server setiap kali berubah
  useEffect(() => {
    if (selectedUser) {
      try {
        // Simpan ke localStorage sebagai fallback
        localStorage.setItem('selectedUser', selectedUser);
        
        // Simpan ke server
        saveSelectedUser(selectedUser).then(success => {
          if (success) {
            console.log(`Selected user ${selectedUser} saved to server`);
          } else {
            console.error(`Failed to save selected user ${selectedUser} to server`);
          }
        });
      } catch (e) {
        console.error('Error saving selectedUser:', e);
      }
    }
  }, [selectedUser]);
  
  useEffect(() => {
    if (threadMessages.length > 0 && selectedUser) {
      try {
        const cacheKey = `threadMessages_${selectedUser}`;
        localStorage.setItem(cacheKey, JSON.stringify(threadMessages));
        localStorage.setItem(`${cacheKey}_lastFetch`, new Date().getTime().toString());
      } catch (e) {
        console.error('Error saving threadMessages to localStorage:', e);
      }
    }
  }, [threadMessages, selectedUser]);
  
  // Function to fetch user analytics data with caching
  const fetchUserData = async (forceRefresh = false) => {
    try {
      // Jangan set loading state jika kita sudah memiliki data
      if (Object.keys(userAnalytics).length === 0 || !userAnalytics.users) {
        setIsLoading(true);
      }
      setError(null);
      
      // Cek apakah ada data cache yang masih valid
      const cachedData = localStorage.getItem('userAnalytics');
      const lastFetchTime = localStorage.getItem('userAnalyticsLastFetch');
      const now = new Date().getTime();
      const cacheExpiry = 5 * 60 * 1000; // 5 menit
      
      // Gunakan cache jika belum expired dan tidak dipaksa refresh
      if (cachedData && lastFetchTime && !forceRefresh && (now - parseInt(lastFetchTime)) < cacheExpiry) {
        console.log('Using cached user analytics data');
        const parsedData = JSON.parse(cachedData);
        if (parsedData && parsedData.users && Object.keys(parsedData.users).length > 0) {
          setUserAnalytics(parsedData);
          setIsLoading(false);
          
          // Tetap lakukan fetch di background untuk update data
          fetchAnalyticsUsers().then(freshData => {
            if (freshData && freshData.users) {
              console.log('Background refresh of user analytics data');
              setUserAnalytics(freshData);
            }
          }).catch(err => console.error('Background fetch error:', err));
          
          return;
        }
      }
      
      // Jika tidak ada cache atau cache expired, fetch data baru
      const userData = await fetchAnalyticsUsers();
      console.log('Fetched fresh user analytics data:', userData);
      
      if (userData && userData.users) {
        setUserAnalytics(userData);
      } else {
        // Jika gagal fetch data baru tapi ada cache, gunakan cache
        if (cachedData) {
          console.log('Fetch failed, using cached data');
          const parsedData = JSON.parse(cachedData);
          if (parsedData && parsedData.users) {
            setUserAnalytics(parsedData);
          } else {
            setError(t('conversations.errorLoading'));
          }
        } else {
          setError(t('conversations.errorLoading'));
        }
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError(t('conversations.errorLoading'));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to fetch thread messages for a selected user with caching
  const fetchUserThreadMessages = async (phoneNumber: string, forceRefresh = false) => {
    try {
      setIsLoadingThread(true);
      
      // Cek apakah ada cache untuk thread messages pengguna ini
      const cacheKey = `threadMessages_${phoneNumber}`;
      const cachedMessages = localStorage.getItem(cacheKey);
      const lastFetchTime = localStorage.getItem(`${cacheKey}_lastFetch`);
      const now = new Date().getTime();
      const cacheExpiry = 5 * 60 * 1000; // 5 menit
      
      // Gunakan cache jika belum expired dan tidak dipaksa refresh
      if (cachedMessages && lastFetchTime && !forceRefresh && (now - parseInt(lastFetchTime)) < cacheExpiry) {
        console.log(`Using cached thread messages for ${phoneNumber}`);
        const parsedMessages = JSON.parse(cachedMessages);
        setThreadMessages(parsedMessages);
        setIsLoadingThread(false);
        
        // Tetap lakukan fetch di background untuk update data
        fetchThreadMessages(phoneNumber).then(freshData => {
          if (freshData && freshData.messages) {
            console.log(`Background refresh of thread messages for ${phoneNumber}`);
            setThreadMessages(freshData.messages);
          }
        }).catch(err => console.error('Background thread fetch error:', err));
        
        return;
      }
      
      // Jika tidak ada cache atau cache expired, fetch data baru
      const threadData = await fetchThreadMessages(phoneNumber);
      console.log('Fetched thread messages:', threadData);
      
      if (threadData && threadData.messages) {
        setThreadMessages(threadData.messages);
      } else if (cachedMessages) {
        // Jika gagal fetch tapi ada cache, gunakan cache
        setThreadMessages(JSON.parse(cachedMessages));
      } else {
        setThreadMessages([]);
      }
    } catch (err) {
      console.error('Error fetching thread messages:', err);
      
      // Jika error tapi ada cache, gunakan cache
      const cacheKey = `threadMessages_${phoneNumber}`;
      const cachedMessages = localStorage.getItem(cacheKey);
      if (cachedMessages) {
        setThreadMessages(JSON.parse(cachedMessages));
      }
    } finally {
      setIsLoadingThread(false);
    }
  };
  
  // Handle user selection dengan menyimpan pilihan ke server
  const handleUserSelect = (phoneNumber: string) => {
    setSelectedUser(phoneNumber);
    fetchUserThreadMessages(phoneNumber);
  };
  
  // Function untuk me-refresh data secara manual
  const handleRefreshData = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    fetchUserData(true); // Force refresh
    if (selectedUser) {
      fetchUserThreadMessages(selectedUser, true); // Force refresh thread messages juga
    }
  };
  
  // Initial data fetch dan setup WebSocket
  useEffect(() => {
    console.log('Setting up data fetching and WebSocket');
    
    // Muat data dari cache atau server
    fetchUserData(false); // Gunakan cache jika tersedia untuk menghindari loading state
    
    // Ambil selectedUser dari server
    const loadSelectedUser = async () => {
      try {
        const serverSelectedUser = await getSelectedUser();
        if (serverSelectedUser) {
          console.log(`Loaded selected user from server: ${serverSelectedUser}`);
          setSelectedUser(serverSelectedUser);
          fetchUserThreadMessages(serverSelectedUser, false);
        } else {
          // Fallback ke localStorage jika tidak ada di server
          const localSelectedUser = localStorage.getItem('selectedUser');
          if (localSelectedUser) {
            console.log(`Loaded selected user from localStorage: ${localSelectedUser}`);
            setSelectedUser(localSelectedUser);
            fetchUserThreadMessages(localSelectedUser, false);
          }
        }
      } catch (e) {
        console.error('Error loading selected user:', e);
        // Fallback ke localStorage jika gagal mengambil dari server
        const localSelectedUser = localStorage.getItem('selectedUser');
        if (localSelectedUser) {
          setSelectedUser(localSelectedUser);
          fetchUserThreadMessages(localSelectedUser, false);
        }
      }
    };
    
    loadSelectedUser();
    
    // Jika ada selectedUser yang tersimpan, muat thread messages-nya
    if (selectedUser) {
      fetchUserThreadMessages(selectedUser, false); // Gunakan cache jika tersedia
    }
    
    // Set up WebSocket untuk pembaruan real-time
    const setupWebSocket = () => {
      console.log('Setting up WebSocket connection');
      websocketService.connect();
      
      // Listen untuk pembaruan data pengguna
      websocketService.on('analytics_update', (data: any) => {
        if (data.type === 'users') {
          console.log('Received user analytics update via WebSocket');
          // Pastikan data yang diterima valid
          if (data.data && data.data.users) {
            // Update state dengan data baru
            setUserAnalytics(data.data);
            
            // Jika ada selected_user di data, update state
            if (data.data.selected_user) {
              setSelectedUser(data.data.selected_user);
            }
          }
        }
      });
      
      // Listen untuk pembaruan preferensi pengguna
      websocketService.on('user_preference_update', (data: any) => {
        if (data.type === 'selected_user' && data.selected_user) {
          console.log(`Received selected user update via WebSocket: ${data.selected_user}`);
          setSelectedUser(data.selected_user);
        }
      });
      
      // Listen untuk pembaruan thread messages
      websocketService.on('thread_update', (data: any) => {
        if (data.sender === selectedUser) {
          console.log(`Received thread update for ${selectedUser} via WebSocket`);
          if (data.messages && Array.isArray(data.messages)) {
            setThreadMessages(data.messages);
          }
        }
      });
      
      return () => {
        websocketService.disconnect();
      };
    };
    
    const cleanup = setupWebSocket();
    
    // Polling untuk memastikan data tetap segar
    const pollingInterval = setInterval(() => {
      // Fetch user data di background
      fetchAnalyticsUsers().then(freshData => {
        if (freshData && freshData.users) {
          console.log('Polling refresh of user analytics data');
          setUserAnalytics(freshData);
        }
      }).catch(err => console.error('Polling fetch error:', err));
      
      // Fetch thread messages jika ada selectedUser
      if (selectedUser) {
        fetchThreadMessages(selectedUser).then(freshData => {
          if (freshData && freshData.messages) {
            console.log(`Polling refresh of thread messages for ${selectedUser}`);
            setThreadMessages(freshData.messages);
          }
        }).catch(err => console.error('Polling thread fetch error:', err));
      }
    }, 10000); // Polling setiap 10 detik
    
    return () => {
      cleanup();
      clearInterval(pollingInterval);
    };
  }, [selectedUser]); // Re-run effect jika selectedUser berubah
  
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
              onClick={handleRefreshData}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              {t('common.retry')}
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Get users data - pastikan selalu ada data
  const users = userAnalytics?.users || {};
  const userPhoneNumbers = Object.keys(users);
  
  // Debug info
  console.log('Current userAnalytics:', userAnalytics);
  console.log('User phone numbers:', userPhoneNumbers);
  
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          <div className="bg-white p-4 shadow-sm">
            <h1 className="text-2xl font-bold">{t('users.title')}</h1>
            <p className="text-gray-500">
              {userPhoneNumbers.length} {t('users.totalUsers')}
            </p>
          </div>
          
          <div className="flex-1 overflow-hidden flex">
            {/* Left panel - User list */}
            <div className="w-1/3 p-4 overflow-y-auto border-r">
              <div className="mb-4">
                <button 
                  onClick={handleRefreshData}
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
                  {t('users.refreshUsers')}
                </button>
              </div>
              
              {userPhoneNumbers.length === 0 ? (
                <div className="text-center p-6 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">{t('users.noUsersFound')}</p>
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
                  onRefresh={(phoneNumber) => fetchUserThreadMessages(phoneNumber, true)}
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
                  <h3 className="text-lg font-medium text-gray-600">{t('users.selectUser')}</h3>
                  <p className="text-gray-500 mt-2">
                    {t('users.selectUserDescription')}
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
