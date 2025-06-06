'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { id as idLocale, enUS } from 'date-fns/locale';
import { UserAnalytics, UserData } from '../types/analytics';
import { ThreadMessage } from '../types/thread';
import { fetchAnalyticsUsers, fetchThreadMessages, getSelectedUser, saveSelectedUser } from '../services/api';
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
  
  // Cek last_interaction di berbagai lokasi yang mungkin (untuk kompatibilitas dengan berbagai format data)
  const lastInteractionStr = userData.details.last_interaction || 
                           (userData as any).last_interaction || 
                           userData.details.first_interaction || 
                           (userData as any).first_interaction;
                           
  // Pastikan lastInteraction adalah Date yang valid
  let lastInteraction;
  try {
    // Pastikan kita selalu mendapatkan timestamp terbaru
    lastInteraction = new Date(lastInteractionStr);
    // Validasi tanggal - jika invalid, gunakan waktu sekarang
    if (isNaN(lastInteraction.getTime())) {
      console.warn(`Invalid last_interaction date for user ${phoneNumber}: ${lastInteractionStr}`);
      lastInteraction = new Date();
    }
  } catch (e) {
    console.error(`Error parsing last_interaction date for user ${phoneNumber}:`, e);
    lastInteraction = new Date();
  }
  
  // Gunakan React.useMemo untuk memastikan format tanggal hanya dihitung ulang saat lastInteraction berubah
  const formattedDate = React.useMemo(() => {
    return format(lastInteraction, 'dd MMM yyyy HH:mm', { locale: language === 'id' ? idLocale : enUS });
  }, [lastInteraction, language]);
  
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
          {t('analytics.lastActive')}: {formattedDate}
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

interface AnalyticsViewProps {
  phoneNumber: string;
  userData: UserData;
  isLoading: boolean;
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
          <h2 className="text-lg font-semibold">{t('conversations.chatThread')}</h2>
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

const AnalyticsView: React.FC<AnalyticsViewProps> = ({ phoneNumber, userData, isLoading }) => {
  const { t, language } = useLanguage();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <CircularProgress />
      </div>
    );
  }
  
  if (!userData) {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold">{t('analytics.analyticsThread')}</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-16 w-16 text-gray-400 mx-auto mb-4" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-600">{t('analytics.noDataAvailable')}</h3>
          </div>
        </div>
      </div>
    );
  }
  
  // Extract user details
  const { details, latest_analysis, interactions } = userData;
  const lastInteraction = new Date(details.last_interaction || details.first_interaction);
  
  return (
    <div className="h-full flex flex-col">
      <div className="bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">{t('analytics.analyticsThread')}</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {/* User Profile Section */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <h3 className="text-md font-semibold mb-2">{t('analytics.userProfile')}</h3>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="text-sm">
              <span className="font-medium">{t('analytics.name')}:</span> 
              <span className="ml-1">{details.name || t('analytics.notProvided')}</span>
            </div>
            
            {details.gender && (
              <div className="text-sm">
                <span className="font-medium">{t('analytics.gender')}:</span>
                <span className="ml-1">
                  {details.gender === 'male' ? (language === 'en' ? 'Male' : 'Laki-laki') : (language === 'en' ? 'Female' : 'Perempuan')}
                </span>
              </div>
            )}
            
            {details.age && (
              <div className="text-sm">
                <span className="font-medium">{t('analytics.age')}:</span>
                <span className="ml-1">{details.age}</span>
              </div>
            )}
            
            <div className="text-sm">
              <span className="font-medium">{t('analytics.lastActive')}:</span>
              <span className="ml-1">{format(lastInteraction, 'dd MMM yyyy HH:mm', { locale: language === 'id' ? idLocale : enUS })}</span>
            </div>
          </div>
        </div>
        
        {/* Health Complaints Section */}
        {details.health_complaints && details.health_complaints.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <h3 className="text-md font-semibold mb-2">{t('analytics.complaints')}</h3>
            <div className="flex flex-wrap gap-1">
              {details.health_complaints.map((complaint, index) => (
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
        
        {/* Conversion Barriers Section */}
        {details.conversion_barriers && details.conversion_barriers.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <h3 className="text-md font-semibold mb-2">{t('analytics.barriers')}</h3>
            <div className="flex flex-wrap gap-1">
              {details.conversion_barriers.map((barrier, index) => (
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
        
        {/* Interaction History */}
        {interactions && interactions.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-md font-semibold mb-2">{t('analytics.interactionHistory')}</h3>
            <div className="space-y-3">
              {interactions.map((interaction, index) => {
                const interactionDate = new Date(interaction.timestamp);
                return (
                  <div key={index} className="border-l-2 border-blue-500 pl-3 py-1">
                    <div className="text-xs text-gray-500">
                      {format(interactionDate, 'dd MMM yyyy HH:mm', { locale: language === 'id' ? idLocale : enUS })}
                    </div>
                    
                    {interaction.analysis.emotion && (
                      <div className="text-sm mt-1">
                        <span className="font-medium">{t('analytics.emotion')}:</span>
                        <span className={`ml-1 ${interaction.analysis.emotion === 'positive' ? 'text-green-600' : interaction.analysis.emotion === 'negative' ? 'text-red-600' : 'text-gray-600'}`}>
                          {interaction.analysis.emotion === 'positive' ? t('analytics.positive') : 
                           interaction.analysis.emotion === 'negative' ? t('analytics.negative') : t('analytics.neutral')}
                        </span>
                      </div>
                    )}
                    
                    {interaction.analysis.interest_level && (
                      <div className="text-sm">
                        <span className="font-medium">{t('analytics.interestLevel')}:</span>
                        <span className="ml-1">
                          {interaction.analysis.interest_level === 'high' ? t('analytics.high') : 
                           interaction.analysis.interest_level === 'medium' ? t('analytics.medium') : t('analytics.low')}
                        </span>
                      </div>
                    )}
                    
                    {interaction.analysis.urgency_level && (
                      <div className="text-sm">
                        <span className="font-medium">{t('analytics.urgencyLevel')}:</span>
                        <span className={`ml-1 ${interaction.analysis.urgency_level === 'high' ? 'text-red-600' : interaction.analysis.urgency_level === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>
                          {interaction.analysis.urgency_level === 'high' ? t('analytics.high') : 
                           interaction.analysis.urgency_level === 'medium' ? t('analytics.medium') : t('analytics.low')}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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
  
  // State untuk memaksa re-render komponen
  const [forceUpdate, setForceUpdate] = useState<number>(0);
  
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
        // Menggunakan pendekatan merge yang sama dengan WebSocket handler
        setUserAnalytics(prevState => {
          // Jika prevState kosong atau tidak memiliki users, gunakan data baru
          if (!prevState || !prevState.users || Object.keys(prevState.users).length === 0) {
            return userData;
          }
          
          // Merge users dari data baru dengan data yang sudah ada
          const mergedUsers = { ...prevState.users };
          
          // Update atau tambahkan user baru
          Object.entries(userData.users).forEach(([phone, userData]) => {
            mergedUsers[phone] = userData as UserData;
          });
          
          // Return state baru dengan users yang sudah di-merge
          return {
            ...userData,
            users: mergedUsers
          };
        });
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
          console.log(`Background refresh of thread messages for ${phoneNumber}`);
          setThreadMessages(freshData);
        }).catch(err => console.error('Background thread fetch error:', err));
        
        return;
      }
      
      // Jika tidak ada cache atau cache expired, fetch data baru
      const threadData = await fetchThreadMessages(phoneNumber);
      console.log('Fetched thread messages:', threadData);
      
      // threadData sekarang adalah array pesan langsung
      if (threadData && threadData.length > 0) {
        setThreadMessages(threadData);
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
  const handleUserSelect = async (phoneNumber: string) => {
    // Update state terlebih dahulu untuk responsivitas UI
    setSelectedUser(phoneNumber);
    
    // Segera fetch thread messages untuk UX yang lebih baik
    fetchUserThreadMessages(phoneNumber);
    
    // Simpan ke localStorage sebagai fallback utama
    localStorage.setItem('selectedUser', phoneNumber);
    
    // Simpan selected user ke server untuk persistensi antar sesi
    console.log(`Attempting to save selected user to server: ${phoneNumber}`);
    const result = await saveSelectedUser(phoneNumber);
    
    if (result.success !== false) {
      console.log('Selected user successfully saved to server:', result);
      
      // Jika berhasil disimpan ke server, emitkan juga event WebSocket
      // untuk memastikan semua client terhubung mendapatkan update yang sama
      if (websocketService.isConnected()) {
        websocketService.emit('user_preference_update', {
          type: 'selected_user',
          selected_user: phoneNumber
        });
        console.log('Sent selected user update via WebSocket');
      }
    } else {
      // Jika gagal, tampilkan pesan error tapi tetap lanjutkan dengan localStorage
      console.warn('Failed to save selected user to server:', result.error || 'Unknown error');
      console.info('Using localStorage fallback instead');
    }
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
    
    // PENTING: Segera ambil data users dari server tanpa menunggu cache
    // Gunakan true untuk force refresh data langsung dari server
    fetchUserData(true);
    
    // Ambil selectedUser dari server
    const loadSelectedUser = async () => {
      try {
        const serverSelectedUser = await getSelectedUser();
        if (serverSelectedUser) {
          console.log(`Loaded selected user from server: ${serverSelectedUser}`);
          setSelectedUser(serverSelectedUser);
          fetchUserThreadMessages(serverSelectedUser, true); // Force refresh thread messages
        } else {
          // Fallback ke localStorage jika tidak ada di server
          const localSelectedUser = localStorage.getItem('selectedUser');
          if (localSelectedUser) {
            console.log(`Loaded selected user from localStorage: ${localSelectedUser}`);
            setSelectedUser(localSelectedUser);
            fetchUserThreadMessages(localSelectedUser, true); // Force refresh thread messages
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
    
    // Setup socket connection and handlers
    console.log('Setting up WebSocket connection');

  loadSelectedUser();
    
  // Setup socket connection and handlers
  console.log('Setting up WebSocket connection');

  // Force websocket connection if not already connected
  if (!websocketService.isConnected()) {
    websocketService.connect();
  }
    
  // Tambahkan event listener untuk connection events
  const socketConnectHandler = () => {
    console.log('WebSocket connected, explicitly requesting analytics data');
    // Segera minta data analytics saat terhubung
    websocketService.emit('request_analytics_users');
    websocketService.emit('subscribe_to_analytics');
  };
  
  websocketService.on('connect', socketConnectHandler);

  // Definisikan callback untuk analytics:users event
  const analyticsUsersCallback = (data: UserAnalytics) => {
    console.log('Received analytics:users event:', data);
    console.log('Users count:', data && data.users ? Object.keys(data.users).length : 0);

    // Pastikan data yang diterima valid
    if (data) {
      // Buat deep copy data untuk menghindari referensi issues
      const safeData = JSON.parse(JSON.stringify(data));

      // Ensure users object exists
      if (!safeData.users) safeData.users = {};

      // Merge data baru dengan data yang sudah ada, bukan mengganti seluruhnya
      setUserAnalytics(prevState => {
        // Jika prevState kosong atau tidak memiliki users, gunakan data baru
        if (!prevState || !prevState.users || Object.keys(prevState.users).length === 0) {
          console.log('No previous state, using new data directly');
          return safeData;
        }

        // Merge users dari data baru dengan data yang sudah ada
        const mergedUsers = { ...prevState.users };

        // Update atau tambahkan user baru
        if (safeData.users) {
          Object.entries(safeData.users).forEach(([phone, userData]) => {
            if (userData) {
              mergedUsers[phone] = userData as UserData;
            }
          });
        }

        console.log('Merged users count:', Object.keys(mergedUsers).length);

        // Return state baru dengan users yang sudah di-merge
        return {
          ...safeData,
          users: mergedUsers
        };
      });

      // Simpan data ke localStorage untuk fallback
      try {
        const dataToStore = { ...safeData };
        if (!dataToStore.users) dataToStore.users = {};
        localStorage.setItem('userAnalytics', JSON.stringify(dataToStore));
      } catch (err) {
        console.error('Error saving analytics data to localStorage:', err);
      }
    }
  };

  // Definisikan callback untuk analytics_update event
  const analyticsUpdateCallback = (data: any) => {
    console.log('Received analytics_update event:', data);

    // Check if this is user analytics data
    if (data && data.type === 'user_analytics' && data.data) {
      console.log('Processing user analytics from analytics_update');

      // Process the data similar to analytics:users event
      const safeData = JSON.parse(JSON.stringify(data.data));

      if (!safeData.users) {
        console.warn('analytics_update data missing users object');
        return;
      }

      // Update state with merged data
      setUserAnalytics(prevState => {
        if (!prevState || !prevState.users) return safeData;

        const mergedUsers = { ...prevState.users };

        // Merge new users with existing ones
        Object.entries(safeData.users).forEach(([phone, userData]) => {
          if (userData) {
            // Pastikan last_interaction dipertahankan jika sudah ada
            if (mergedUsers[phone]) {
              const existingLastInteraction = mergedUsers[phone].details?.last_interaction;
              const newLastInteraction = (userData as any).details?.last_interaction;
              
              // Gunakan timestamp terbaru
              if (existingLastInteraction && newLastInteraction) {
                const existingDate = new Date(existingLastInteraction).getTime();
                const newDate = new Date(newLastInteraction).getTime();
                
                // Jika timestamp yang ada lebih baru, pertahankan
                if (existingDate > newDate) {
                  (userData as any).details.last_interaction = existingLastInteraction;
                }
              } else if (existingLastInteraction) {
                // Jika data baru tidak memiliki last_interaction, gunakan yang lama
                (userData as any).details.last_interaction = existingLastInteraction;
              }
            }
            
            // Tambahkan data baru ke mergedUsers
            mergedUsers[phone] = userData as UserData;
          }
        });

        // Force re-render dengan membuat objek baru
        return {
          ...safeData,
          users: { ...mergedUsers }
        };
      });
      
      // Log untuk debugging
      console.log('Updated user analytics state after analytics_update');
      
      // Force re-render komponen
      setForceUpdate(prev => prev + 1);
    }
  };

  // Definisikan callback untuk user_preference_update event
  const userPreferenceCallback = (data: any) => {
    if (data && data.type === 'selected_user' && data.selected_user) {
      console.log(`Received selected user update via WebSocket: ${data.selected_user}`);
      setSelectedUser(data.selected_user);
    }
  };

  // Definisikan callback untuk user_activity event
  const userActivityCallback = (data: any) => {
    if (data && data.user_id) {
      console.log(`Received user activity for ${data.user_id} via WebSocket`);
      
      // Update last_interaction timestamp in user analytics
      setUserAnalytics(prevState => {
        if (!prevState || !prevState.users) return prevState;
        
        const updatedUsers = { ...prevState.users };
        // Normalisasi format nomor telepon (hapus @s.whatsapp.net jika ada)
        const phoneNumber = data.user_id.replace('@s.whatsapp.net', '');
        
        // Cek apakah user ada di analytics dengan berbagai format ID
        const userKey = updatedUsers[phoneNumber] ? phoneNumber : 
                       updatedUsers[data.user_id] ? data.user_id : 
                       updatedUsers[`${phoneNumber}@s.whatsapp.net`] ? `${phoneNumber}@s.whatsapp.net` : null;
        
        if (userKey) {
          // Pastikan timestamp selalu dalam format ISO string yang valid
          const currentTime = data.timestamp || new Date().toISOString();
          
          console.log(`Updating last_interaction for user ${userKey} to ${currentTime}`);
          
          // Perbarui last_interaction dalam details dan juga di root object untuk kompatibilitas
          const updatedUser = {
            ...updatedUsers[userKey],
            last_interaction: currentTime, // Tambahkan di root level untuk kompatibilitas
            details: {
              ...updatedUsers[userKey].details,
              last_interaction: currentTime
            }
          };
          
          // Tambahkan juga interaksi baru ke array interactions jika ada
          if (updatedUsers[userKey].interactions) {
            updatedUser.interactions = [
              ...updatedUsers[userKey].interactions,
              {
                timestamp: currentTime,
                analysis: updatedUsers[userKey].latest_analysis || {
                  name: null,
                  age: null,
                  gender: null,
                  location: null,
                  health_complaints: [],
                  symptoms: [],
                  medical_history: null,
                  urgency_level: null,
                  emotion: null,
                  conversion_barriers: [],
                  interest_level: null,
                  program_awareness: null,
                  timestamp: currentTime
                }
              }
            ].slice(-10); // Simpan hanya 10 interaksi terakhir untuk efisiensi
          }
          
          updatedUsers[userKey] = updatedUser;
          console.log(`Updated last_interaction timestamp for user ${userKey} to ${currentTime}`);
          
          // Simpan ke localStorage untuk persistence
          try {
            const updatedAnalytics = {
              ...prevState,
              users: { ...updatedUsers },
              lastUpdated: new Date().toISOString()
            };
            localStorage.setItem('userAnalytics', JSON.stringify(updatedAnalytics));
            localStorage.setItem('userAnalyticsLastFetch', new Date().getTime().toString());
          } catch (e) {
            console.error('Error saving updated user activity to localStorage:', e);
          }
          
          // Force re-render dengan membuat objek baru
          return {
            ...prevState,
            users: { ...updatedUsers },
            lastUpdated: new Date().toISOString() // Tambahkan timestamp update untuk memastikan React mendeteksi perubahan
          };
        } else {
          console.warn(`User ${data.user_id} not found in analytics data`);
          // Jika user tidak ditemukan, mungkin perlu refresh data dari server
          fetchUserData(true);
          return prevState;
        }
      });
      
      // Force re-render komponen dengan increment counter
      setForceUpdate(prev => prev + 1);
      
      // Jika ini adalah user yang sedang dipilih, refresh thread messages juga
      if (selectedUser && (data.user_id === selectedUser || data.user_id.replace('@s.whatsapp.net', '') === selectedUser)) {
        console.log(`Refreshing thread messages for selected user ${selectedUser}`);
        fetchUserThreadMessages(selectedUser, true); // Force refresh
      }
    }
  };
  
  // Definisikan callback untuk thread_update event
  const threadUpdateCallback = (data: any) => {
    if (data && data.sender) {
      console.log(`Received thread update for ${data.sender} via WebSocket`);
      
      // Update thread messages if this is the selected user
      if (data.sender === selectedUser && data.messages && Array.isArray(data.messages)) {
        setThreadMessages(data.messages);
      }
      
      // Trigger user activity update to update last_interaction
      userActivityCallback({
        user_id: data.sender,
        activity_type: 'message',
        timestamp: data.timestamp || new Date().toISOString()
      });
      
      // Emit user activity event to WebSocket to ensure backend is updated
      websocketService.emit('user_activity', {
        user_id: data.sender,
        activity_type: 'message',
        timestamp: data.timestamp || new Date().toISOString()
      });
    }
  };

  // Explicitly subscribe to analytics events via WebSocket
  console.log('Explicitly subscribing to analytics events via socket');
  websocketService.emit('subscribe_to_analytics');
  
  // Segera minta data analytics users
  console.log('Explicitly requesting analytics users data');
  websocketService.emit('request_analytics_users');

  // Subscribe to all events
  websocketService.subscribeToAnalyticsUsers(analyticsUsersCallback);
  websocketService.on('analytics_update', analyticsUpdateCallback);
  websocketService.on('user_preference_update', userPreferenceCallback);
  websocketService.on('thread_update', threadUpdateCallback);
  websocketService.on('user_activity', userActivityCallback); // Tambahkan subscription untuk user_activity

  // Setup a gentler background refresh that won't disrupt UX
  // Fetch every 15 seconds as backup if WebSocket fails
  let lastRefreshTime = Date.now();
  const backgroundRefreshInterval = setInterval(() => {
    // Only fetch if it's been at least 30 seconds since last update
    const now = Date.now();
    const timeSinceLastUpdate = now - lastRefreshTime;

    if (timeSinceLastUpdate > 30000) { // 30 seconds
      console.log(`Last update was ${timeSinceLastUpdate/1000}s ago, doing background refresh`);

      // Fetch user data in background without loading state
      fetchAnalyticsUsers().then(freshData => {
        if (freshData && freshData.users && Object.keys(freshData.users).length > 0) {
          console.log('Background refresh successful, got', Object.keys(freshData.users).length, 'users');
          lastRefreshTime = Date.now();

          // Use the same merge approach as the WebSocket handler
          setUserAnalytics(prevState => {
            // If there's no previous state, use the new data
            if (!prevState || !prevState.users || Object.keys(prevState.users).length === 0) {
              return freshData;
            }

            // Merge users
            const mergedUsers = { ...prevState.users };
            Object.entries(freshData.users).forEach(([phone, userData]) => {
              if (userData) {
                mergedUsers[phone] = userData as UserData;
              }
            });

            // Return merged state with original count values preserved
            return {
              ...freshData,
              users: mergedUsers
            };
          });
          
          // Simpan ke localStorage untuk persistence
          try {
            localStorage.setItem('userAnalytics', JSON.stringify(freshData));
            localStorage.setItem('userAnalyticsLastFetch', new Date().getTime().toString());
          } catch (e) {
            console.error('Error saving to localStorage:', e);
          }
        } else {
          console.log('Background refresh returned no users, keeping current state');
        }
      }).catch(err => {
        console.error('Error in background refresh:', err);
      });
    } else {
      console.log(`Last update was ${timeSinceLastUpdate/1000}s ago, skipping background refresh`);
    }
  }, 15000); // Check every 15 seconds
  
  // CLEAN UP FUNCTION - sangat penting untuk mencegah memory leak
  return () => {
    console.log('Cleaning up WebSocket subscriptions and intervals');
    
    // Clear the background refresh interval
    clearInterval(backgroundRefreshInterval);
    
    // Unsubscribe from all WebSocket events
    websocketService.unsubscribeFromAnalyticsUsers(analyticsUsersCallback);
    websocketService.off('analytics_update', analyticsUpdateCallback);
    websocketService.off('user_preference_update', userPreferenceCallback);
    websocketService.off('thread_update', threadUpdateCallback);
    websocketService.off('user_activity', userActivityCallback); // Bersihkan langganan user_activity
    websocketService.off('connect', socketConnectHandler);
    
    console.log('Cleanup completed successfully');
  };

}, [selectedUser]); // useEffect dependency

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
            <div className="w-1/4 p-4 overflow-y-auto border-r">
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
            
            {/* Middle panel - Chat conversation thread */}
            <div className="w-2/5 overflow-hidden border-r">
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
            
            {/* Right panel - Analytics thread */}
            <div className="w-1/3 overflow-hidden">
              {selectedUser && users[selectedUser] ? (
                <AnalyticsView
                  phoneNumber={selectedUser}
                  userData={users[selectedUser]}
                  isLoading={isLoading}
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
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
                    />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-600">{t('analytics.selectUser')}</h3>
                  <p className="text-gray-500 mt-2">
                    {t('analytics.selectUserDescription')}
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
