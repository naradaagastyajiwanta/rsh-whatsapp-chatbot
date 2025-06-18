'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { id as idLocale, enUS } from 'date-fns/locale';
import { UserAnalytics, UserData } from '../types/analytics';
import { ThreadMessage } from '../types/thread';
import { fetchAnalyticsUsers, fetchThreadMessages, getSelectedUser, saveSelectedUser, deleteThread } from '../services/api';
import Sidebar from './Sidebar';
import CircularProgress from '@mui/material/CircularProgress';
import websocketService from '../services/websocket';
import { useLanguage } from '../context/LanguageContext';
import UserExportModal from './UserExportModal';

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
  onDeleteThread: () => Promise<void>;
  isDeletingThread?: boolean;
  error?: string | null;
  // Add retry callback for error recovery
  onRetry?: (phoneNumber: string) => void;
}

interface AnalyticsViewProps {
  phoneNumber: string;
  userData: UserData;
  isLoading: boolean;
}

const ThreadView: React.FC<ThreadViewProps> = ({ phoneNumber, messages, isLoading, onRefresh, onDeleteThread, isDeletingThread = false, error, onRetry }) => {
  const { t } = useLanguage();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Handler untuk tombol refresh
  const handleRefreshClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onRefresh(phoneNumber);
  };
  
  // Handler for retry - uses onRetry if available, otherwise falls back to onRefresh
  const handleRetryClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (onRetry) {
      onRetry(phoneNumber);
    } else {
      onRefresh(phoneNumber);
    }
  };
  
  // Handler for delete button
  const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (messages.length === 0) {
      console.log('No messages to delete');
      return;
    }
    setShowDeleteConfirm(true);
  };
  
  // Handler for confirming deletion
  const handleConfirmDelete = async () => {
    try {
      await onDeleteThread();
    } catch (error) {
      console.error('Error in delete thread confirmation:', error);
    } finally {
      setShowDeleteConfirm(false);
    }
  };
  
  // Handler for canceling deletion
  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };
  
  // Format timestamp safely
  const formatTimestamp = (timestamp: number | string) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (err) {
      console.error('Error formatting timestamp:', timestamp, err);
      return 'Invalid date';
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <CircularProgress />
        <p className="ml-3 text-gray-600">{t('users.loadingMessages') || 'Loading messages...'}</p>
      </div>
    );
  }
  
  if (error) {
    // Cek apakah error adalah "Thread tidak ditemukan"
    const isThreadNotFound = error.includes('Thread tidak ditemukan') || error.includes('not found');
    
    return (
      <div className="flex items-center justify-center h-full">
        <div className={`${isThreadNotFound ? 'bg-blue-50' : 'bg-red-50'} p-6 rounded-lg text-center`}>
          {isThreadNotFound ? (
            // Icon informasi untuk thread tidak ditemukan
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-12 w-12 text-blue-500 mx-auto mb-4" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          ) : (
            // Icon error untuk error lainnya
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
          )}
          
          <h3 className={`text-lg font-medium ${isThreadNotFound ? 'text-blue-800' : 'text-red-800'}`}>{error}</h3>
          
          {!isThreadNotFound && (
            // Hanya tampilkan tombol retry jika bukan thread tidak ditemukan
            <div className="mt-4 flex justify-center space-x-3">
              <button 
                onClick={handleRetryClick}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                {t('common.retry')}
              </button>
              {messages.length > 0 && (
                <button 
                  onClick={() => {}}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                >
                  {t('users.useCachedData') || 'Use cached data'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Validate messages and sort by creation time (newest first)
  const validMessages = messages.filter(msg => msg !== null && msg !== undefined);
  const sortedMessages = [...validMessages].sort((a, b) => {
    try {
      // Handle different timestamp formats safely
      const timeA = typeof a.created_at === 'string' ? new Date(a.created_at).getTime() : a.created_at;
      const timeB = typeof b.created_at === 'string' ? new Date(b.created_at).getTime() : b.created_at;
      return timeB - timeA;
    } catch (err) {
      console.error('Error sorting messages:', err);
      return 0;
    }
  });
  
  return (
    <div className="h-full flex flex-col">
      {/* Header dengan tombol refresh dan delete */}
      <div className="bg-white p-4 shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">{t('conversations.chatThread')}</h2>
          <p className="text-sm text-gray-500">
            {messages.length > 0 ? 
              t('conversations.messagesCount', { count: messages.length }) : 
              t('conversations.noMessages')}
          </p>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={handleDeleteClick}
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 flex items-center"
            disabled={isLoading || isDeletingThread || messages.length === 0}
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
              />
            </svg>
            {t('common.delete') || 'Delete'}
          </button>
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
      </div>
      
      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{t('users.confirmDeleteThread') || 'Delete Thread?'}</h3>
            <p className="text-sm text-gray-500 mb-5">
              {t('users.confirmDeleteThreadMessage') || 'Are you sure you want to delete this thread? This action cannot be undone.'}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                {t('common.delete') || 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      
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
  
  // Estados para filtrado de usuarios
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [complaintFilter, setComplaintFilter] = useState<string>('all');
  const [uniqueComplaints, setUniqueComplaints] = useState<string[]>([]);
  
  // Inisialisasi selectedUser sebagai null, akan diambil dari server
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isDeletingThread, setIsDeletingThread] = useState(false);
  const [isShowingThreadPanel, setIsShowingThreadPanel] = useState(true);
  const [isShowingAnalyticsPanel, setIsShowingAnalyticsPanel] = useState(false);
  const [sortBy, setSortBy] = useState<string>('lastMessage');
  const [selectedUserData, setSelectedUserData] = useState<UserData | null>(null);
  const [analyticsRefreshTimestamp, setAnalyticsRefreshTimestamp] = useState<number>(Date.now());
  const [isLoadingUserAnalytics, setIsLoadingUserAnalytics] = useState<boolean>(false);
  const [showPersistentError, setShowPersistentError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  // Handle thread deletion for a specific user
  const handleDeleteThread = async () => {
    if (!selectedUser) return;
    
    setIsDeletingThread(true);
    try {
      const result = await deleteThread(selectedUser);
      
      if (result.status === 'success') {
        console.log(`Thread for ${selectedUser} deleted successfully`);
        // Clear the thread messages
        setThreadMessages([]);
        
        // Update localStorage cache
        const cacheKey = `threadMessages_${selectedUser}`;
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(`${cacheKey}_lastFetch`);
        
        // Show success message
        setErrorMessage('');
        
        // Force refresh user analytics to reflect changes
        fetchUserData(true);
      } else {
        console.error('Failed to delete thread:', result.message || 'Unknown error');
        setErrorMessage(t('users.errorDeletingThread') || 'Failed to delete thread');
        setShowPersistentError(true);
      }
    } catch (error) {
      console.error('Error deleting thread:', error);
      setErrorMessage(t('users.errorDeletingThread') || 'Failed to delete thread');
      setShowPersistentError(true);
    } finally {
      setIsDeletingThread(false);
    }
  };
  
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
  
  // Efecto para extraer todas las quejas de salud únicas de los usuarios
  useEffect(() => {
    if (userAnalytics && userAnalytics.users) {
      const complaints: Set<string> = new Set();
      
      // Recorrer todos los usuarios y recolectar quejas únicas
      Object.values(userAnalytics.users).forEach(userData => {
        if (userData.details && userData.details.health_complaints && Array.isArray(userData.details.health_complaints)) {
          userData.details.health_complaints.forEach(complaint => {
            if (complaint && complaint.trim() !== '') {
              complaints.add(complaint.trim());
            }
          });
        }
      });
      
      // Convertir Set a Array y actualizar el estado
      setUniqueComplaints(Array.from(complaints).sort());
    }
  }, [userAnalytics]);
  
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
  
  // Function to fetch thread messages for a selected user with caching and better error handling
  const fetchUserThreadMessages = async (phoneNumber: string, forceRefresh = false) => {
    try {
      if (!phoneNumber) {
        console.error('fetchUserThreadMessages called with empty phone number');
        setThreadError('Invalid phone number');
        setIsLoadingThread(false);
        return;
      }

      console.log(`Starting fetchUserThreadMessages for: ${phoneNumber}`);
      
      // Clear previous thread messages and errors immediately when switching users
      setThreadMessages([]);
      setThreadError(null);
      setIsLoadingThread(true);
      
      // Normalize phone number consistently
      // First, strip any @s.whatsapp.net suffix if it exists
      const strippedPhoneNumber = phoneNumber.replace('@s.whatsapp.net', '');
      // Then add it back in a consistent format
      const normalizedPhoneNumber = `${strippedPhoneNumber}@s.whatsapp.net`;
      
      console.log(`Using normalized phone number: ${normalizedPhoneNumber}`);
      
      // Check cache for thread messages
      const cacheKey = `threadMessages_${normalizedPhoneNumber}`;
      const cachedMessages = localStorage.getItem(cacheKey);
      const lastFetchTime = localStorage.getItem(`${cacheKey}_lastFetch`);
      const now = new Date().getTime();
      const cacheExpiry = 5 * 60 * 1000; // 5 minutes
      
      // Use cache if available and not forced to refresh
      if (cachedMessages && lastFetchTime && !forceRefresh && (now - parseInt(lastFetchTime)) < cacheExpiry) {
        console.log(`Using cached thread messages for ${normalizedPhoneNumber}`);
        try {
          const parsedMessages = JSON.parse(cachedMessages);
          if (Array.isArray(parsedMessages)) {
            setThreadMessages(parsedMessages);
            setIsLoadingThread(false);
            
            // Still fetch in background for updates
            setTimeout(() => {
              fetchThreadMessages(normalizedPhoneNumber)
                .then(freshData => {
                  console.log(`Background refresh of thread messages for ${normalizedPhoneNumber}`);
                  if (freshData && Array.isArray(freshData) && freshData.length > 0) {
                    // Only update if there are changes to avoid unnecessary re-renders
                    if (JSON.stringify(freshData) !== JSON.stringify(parsedMessages)) {
                      console.log('Thread messages changed, updating state');
                      // Make sure we're still on the same user before updating
                      if (selectedUser === phoneNumber) {
                        setThreadMessages(freshData);
                        // Update cache
                        localStorage.setItem(cacheKey, JSON.stringify(freshData));
                        localStorage.setItem(`${cacheKey}_lastFetch`, new Date().getTime().toString());
                      }
                    } else {
                      console.log('Thread messages unchanged, keeping current state');
                    }
                  }
                })
                .catch(err => {
                  console.error('Background thread fetch error:', err);
                  // Don't show error for background refresh failures
                });
            }, 500); // Small delay to prioritize UI responsiveness
            
            return;
          } else {
            console.error('Cached messages is not an array, clearing cache');
            localStorage.removeItem(cacheKey);
            localStorage.removeItem(`${cacheKey}_lastFetch`);
          }
        } catch (parseError) {
          console.error('Error parsing cached messages:', parseError);
          // Clear invalid cache and continue with fresh fetch
          localStorage.removeItem(cacheKey);
          localStorage.removeItem(`${cacheKey}_lastFetch`);
        }
      }
      
      // If no cache or cache expired, fetch new data
      console.log(`Fetching fresh thread messages for ${normalizedPhoneNumber}`);
      try {
        const threadData = await fetchThreadMessages(normalizedPhoneNumber);
        console.log('Fetched thread messages:', threadData);
        
        // Make sure we're still on the same user before updating
        if (selectedUser !== phoneNumber) {
          console.log('User changed during fetch, discarding results');
          return;
        }
        
        // Validate and set thread data
        if (threadData && Array.isArray(threadData)) {
          if (threadData.length > 0) {
            console.log(`Got ${threadData.length} thread messages`);
            setThreadMessages(threadData);
            // Update cache
            localStorage.setItem(cacheKey, JSON.stringify(threadData));
            localStorage.setItem(`${cacheKey}_lastFetch`, new Date().getTime().toString());
          } else {
            console.log('Got empty thread messages array');
            setThreadMessages([]);
            // Still cache the empty array to prevent repeated fetches
            localStorage.setItem(cacheKey, JSON.stringify([]));
            localStorage.setItem(`${cacheKey}_lastFetch`, new Date().getTime().toString());
          }
        } else {
          console.error('Invalid thread data format:', threadData);
          throw new Error('Invalid thread data format received from server');
        }
      } catch (fetchError: any) {
        console.error('Error during thread fetch:', fetchError);
        
        // Make sure we're still on the same user before updating error state
        if (selectedUser !== phoneNumber) {
          console.log('User changed during fetch error handling, discarding');
          return;
        }
        
        // Try to use cached data as fallback
        if (cachedMessages) {
          console.log('API fetch failed, trying to use cached messages');
          try {
            const parsedMessages = JSON.parse(cachedMessages);
            if (Array.isArray(parsedMessages)) {
              setThreadMessages(parsedMessages);
              // Set a warning message but don't block the UI
              setThreadError(t('users.usingCachedData') || 'Menggunakan data cache. Refresh untuk mencoba lagi.');
            } else {
              throw new Error('Invalid cache format');
            }
          } catch (parseError) {
            console.error('Error parsing cached messages:', parseError);
            setThreadMessages([]);
            setThreadError(t('users.failedToLoadMessages') || 'Gagal mengambil thread messages. Silakan coba lagi.');
          }
        } else {
          console.log('No cached messages available after fetch error');
          setThreadMessages([]);
          
          // Set user-friendly error message
          if (fetchError.response?.status === 404) {
            // Khusus untuk 404 (thread tidak ditemukan), kita set pesan khusus
            // dan set threadMessages ke array kosong (bukan error state)
            setThreadMessages([]);
            // Pastikan pesan thread tidak ditemukan dalam bahasa Indonesia
            setThreadError('Thread tidak ditemukan untuk user ini');
          } else {
            // Untuk error lainnya
            const errorMsg = fetchError.response?.status === 500
              ? (t('users.serverError') || 'Server error saat mengambil thread messages')
              : (t('users.failedToLoadMessages') || 'Gagal mengambil thread messages');
            
            setThreadError(errorMsg);
          }
        }
      }
    } catch (err: any) {
      console.error('Unexpected error in fetchUserThreadMessages:', err);
      
      // Make sure we're still on the same user before updating error state
      if (selectedUser !== phoneNumber) {
        console.log('User changed during error handling, discarding');
        return;
      }
      
      // Set user-friendly error message for unexpected errors
      setThreadError(t('users.unexpectedError') || 'Terjadi kesalahan tidak terduga. Silakan coba lagi.');
      setThreadMessages([]);
    } finally {
      // Only update loading state if we're still on the same user
      if (selectedUser === phoneNumber) {
        setIsLoadingThread(false);
      }
    }
  };
  
  // Handle user selection dengan menyimpan pilihan ke server
  const handleUserSelect = async (phoneNumber: string) => {
    // Prevent selecting the same user multiple times
    if (selectedUser === phoneNumber && !isLoadingThread) {
      console.log(`User ${phoneNumber} already selected, skipping`);
      return;
    }

    console.log(`Selecting user: ${phoneNumber}`);
    
    // Clear previous thread error state
    setThreadError(null);
    
    // Update state terlebih dahulu untuk responsivitas UI
    setSelectedUser(phoneNumber);
    setSelectedUserData(null); // Clear previous user data
    
    // Segera fetch thread messages untuk UX yang lebih baik
    fetchUserThreadMessages(phoneNumber);
    
    // Simpan ke localStorage sebagai fallback utama
    localStorage.setItem('selectedUser', phoneNumber);
    
    // Update selected user data from analytics
    if (userAnalytics?.users?.[phoneNumber]) {
      setSelectedUserData(userAnalytics.users[phoneNumber]);
    } else {
      // Try with normalized phone number
      const strippedPhoneNumber = phoneNumber.replace('@s.whatsapp.net', '');
      const withSuffix = `${strippedPhoneNumber}@s.whatsapp.net`;
      
      if (userAnalytics?.users?.[strippedPhoneNumber]) {
        setSelectedUserData(userAnalytics.users[strippedPhoneNumber]);
      } else if (userAnalytics?.users?.[withSuffix]) {
        setSelectedUserData(userAnalytics.users[withSuffix]);
      }
    }
    
    // Simpan selected user ke server untuk persistensi antar sesi (async, non-blocking)
    try {
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
    } catch (error) {
      console.error('Error saving selected user to server:', error);
      // Continue with localStorage fallback - don't block UI
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

  // Debounce utility function
  const debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout;
    return function executedFunction(...args: any[]) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // Definisikan callback untuk analytics:users event dengan debouncing
  const analyticsUsersCallback = debounce((data: any) => {
    if (data && data.users) {
      console.log('Received analytics users data via WebSocket:', Object.keys(data.users).length, 'users');
      
      // Validasi struktur data
      const safeData = {
        total_users: data.total_users || 0,
        active_users: data.active_users || 0,
        new_users: data.new_users || 0,
        users: data.users || {}
      };
      
      // Update state dengan merge yang aman
      setUserAnalytics(prevState => {
        // Jika tidak ada state sebelumnya, gunakan data baru
        if (!prevState || !prevState.users || Object.keys(prevState.users).length === 0) {
          return safeData;
        }
        
        // Merge users dengan mempertahankan data yang sudah ada
        const mergedUsers = { ...prevState.users };
        
        Object.entries(safeData.users).forEach(([phone, userData]) => {
          if (userData) {
            mergedUsers[phone] = userData as UserData;
          }
        });
        
        return {
          ...safeData,
          users: mergedUsers
        };
      });
      
      // Simpan ke localStorage untuk persistence
      try {
        localStorage.setItem('userAnalytics', JSON.stringify(safeData));
        localStorage.setItem('userAnalyticsLastFetch', new Date().getTime().toString());
      } catch (e) {
        console.error('Error saving to localStorage:', e);
      }
    }
  }, 500); // Debounce for 500ms

  // Definisikan callback untuk analytics_update event dengan debouncing
  const analyticsUpdateCallback = debounce((data: any) => {
    if (data && data.users) {
      console.log('Received analytics update via WebSocket');
      
      // Validasi struktur data
      const safeData = {
        total_users: data.total_users || 0,
        active_users: data.active_users || 0,
        new_users: data.new_users || 0,
        users: data.users || {}
      };
      
      // Update state dengan merge yang aman
      setUserAnalytics(prevState => {
        if (!prevState || !prevState.users) {
          return safeData;
        }
        
        // Merge users dengan mempertahankan data yang sudah ada
        const mergedUsers = { ...prevState.users };
        
        Object.entries(safeData.users).forEach(([phone, userData]) => {
          if (userData) {
            // Preserve existing last_interaction if it's newer
            const existingUser = mergedUsers[phone];
            if (existingUser && existingUser.details?.last_interaction) {
              const existingLastInteraction = existingUser.details.last_interaction;
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
  }, 300); // Debounce for 300ms

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
        
        // Save to cache with timestamp
        try {
          const cacheKey = `threadMessages_${data.sender}`;
          localStorage.setItem(cacheKey, JSON.stringify(data.messages));
          localStorage.setItem(`${cacheKey}_lastFetch`, Date.now().toString());
        } catch (e) {
          console.error('Error caching thread messages:', e);
        }
      }
    }
  };

  // Handle thread deletion WebSocket events
  const threadDeletedCallback = (data: any) => {
    if (data && data.phone_number) {
      console.log(`Received thread deletion event for ${data.phone_number}`);
      
      // If this is the currently selected user, clear the thread messages
      if (selectedUser === data.phone_number) {
        setThreadMessages([]);
        
        // Clear the cache
        const cacheKey = `threadMessages_${data.phone_number}`;
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(`${cacheKey}_lastFetch`);
        
        // Show a message
        setErrorMessage(t('users.threadDeleted') || 'Thread has been deleted');
        setTimeout(() => setErrorMessage(''), 5000);
      }
      
      // Update analytics to reflect the change
      fetchUserData(true);
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
  websocketService.on('thread_deleted', threadDeletedCallback); // Add subscription for thread deletion events

  // Setup a gentler background refresh that won't disrupt UX
  // Fetch every 60 seconds as backup if WebSocket fails (reduced from 15 seconds)
  let lastRefreshTime = Date.now();
  const backgroundRefreshInterval = setInterval(() => {
    // Only fetch if it's been at least 60 seconds since last update (increased from 30 seconds)
    const now = Date.now();
    const timeSinceLastUpdate = now - lastRefreshTime;

    if (timeSinceLastUpdate > 60000) { // 60 seconds (increased from 30)
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

            // Merge users - only update if data is actually different
            const mergedUsers = { ...prevState.users };
            let hasChanges = false;

            Object.entries(freshData.users).forEach(([phone, userData]) => {
              const existingUser = mergedUsers[phone];
              
              // Only update if user doesn't exist or data has changed
              if (!existingUser || JSON.stringify(existingUser) !== JSON.stringify(userData)) {
                mergedUsers[phone] = userData as UserData;
                hasChanges = true;
              }
            });

            // Only trigger re-render if there are actual changes
            if (hasChanges) {
              console.log('Background refresh found changes, updating state');
              return {
                ...freshData,
                users: mergedUsers
              };
            } else {
              console.log('Background refresh found no changes, keeping current state');
              return prevState;
            }
          });
        }
      }).catch(err => {
        console.error('Background refresh failed:', err);
        // Don't update lastRefreshTime on failure to retry sooner
      });
    }
  }, 60000); // Check every 60 seconds (increased from 15)
  
  // CLEAN UP FUNCTION - sangat penting untuk mencegah memory leak
  return () => {
    console.log('Cleaning up WebSocket listeners');
    clearInterval(backgroundRefreshInterval);
    websocketService.off('connect', socketConnectHandler);
    websocketService.unsubscribeFromAnalyticsUsers(analyticsUsersCallback);
    websocketService.off('analytics_update', analyticsUpdateCallback);
    websocketService.off('user_preference_update', userPreferenceCallback);
    websocketService.off('thread_update', threadUpdateCallback);
    websocketService.off('user_activity', userActivityCallback); // Clean up user activity subscription
    websocketService.off('thread_deleted', threadDeletedCallback); // Clean up thread deletion subscription
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
  
  // Filtrar y ordenar usuarios
  const filteredUsers = Object.entries(users).filter(([phoneNumber, userData]) => {
    // Filtro por texto (nombre o número de teléfono)
    const searchMatches = searchQuery === '' || 
      phoneNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (userData.details.name && userData.details.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Filtro por género
    const genderMatches = genderFilter === 'all' ||
      (userData.details.gender === genderFilter);
    
    // Filtro por queja de salud
    const complaintMatches = complaintFilter === 'all' ||
      (userData.details.health_complaints && 
       Array.isArray(userData.details.health_complaints) &&
       userData.details.health_complaints.includes(complaintFilter));
    
    return searchMatches && genderMatches && complaintMatches;
  });
  
  // Ordenar usuarios por fecha de última interacción (más reciente primero)
  const sortedUsers = filteredUsers.sort(([_, userData1], [__, userData2]) => {
    const getLastInteraction = (userData: UserData) => {
      const lastInteractionStr = userData.details.last_interaction || 
                               (userData as any).last_interaction || 
                               userData.details.first_interaction || 
                               (userData as any).first_interaction || 
                               new Date(0).toISOString();
      
      try {
        return new Date(lastInteractionStr).getTime();
      } catch (e) {
        return 0;
      }
    };
    
    // Ordenar descendente (más reciente primero)
    return getLastInteraction(userData2) - getLastInteraction(userData1);
  });
  
  // Extraer solo los números de teléfono ordenados
  const userPhoneNumbers = sortedUsers.map(([phoneNumber]) => phoneNumber);
  
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
            
            {/* Filtros */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {/* Export button */}
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-5 w-5 mr-1" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" 
                  />
                </svg>
                {t('users.exportUsers') || 'Export Users'}
              </button>

              {/* Búsqueda por nombre o número */}
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder={t('users.searchPlaceholder') || 'Buscar por nombre o número...'}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              {/* Filtro por género */}
              <div>
                <select
                  className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={genderFilter}
                  onChange={(e) => setGenderFilter(e.target.value as 'all' | 'male' | 'female')}
                >
                  <option value="all">{t('users.allGenders') || 'Todos los géneros'}</option>
                  <option value="male">{t('users.maleOnly') || 'Solo hombres'}</option>
                  <option value="female">{t('users.femaleOnly') || 'Solo mujeres'}</option>
                </select>
              </div>
              
              {/* Filtro por queja de salud */}
              {uniqueComplaints.length > 0 && (
                <div>
                  <select
                    className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={complaintFilter}
                    onChange={(e) => setComplaintFilter(e.target.value)}
                  >
                    <option value="all">{t('users.allComplaints') || 'Todas las quejas'}</option>
                    {uniqueComplaints.map(complaint => (
                      <option key={complaint} value={complaint}>{complaint}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
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
                <div className="text-center p-6 bg-gray-50 rounded-lg mt-4">
                  <p className="text-gray-500">{t('users.noMatchingUsers') || 'No se encontraron usuarios que coincidan con los filtros'}</p>
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
                  onRetry={(phoneNumber) => fetchUserThreadMessages(phoneNumber, true)}
                  onDeleteThread={handleDeleteThread}
                  isDeletingThread={isDeletingThread}
                  error={threadError}
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
      
      {/* User Export Modal */}
      <UserExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        users={users}
        uniqueComplaints={uniqueComplaints}
      />
    </div>
  );
};

export default Users;
