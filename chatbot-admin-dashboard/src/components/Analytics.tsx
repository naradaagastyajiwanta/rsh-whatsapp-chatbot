'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { id as idLocale, enUS } from 'date-fns/locale';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  PieProps
} from 'recharts';
import { Tab, Tabs } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import { PerformanceMetrics, UserAnalytics, UserInsight, UserData } from '../types/analytics';
import websocketService from '../services/websocket';
import { fetchAnalyticsPerformance, fetchAnalyticsUsers, checkBackendStatus } from '../services/analyticsService';
import Sidebar from './Sidebar';
import { useLanguage } from '../context/LanguageContext';

// Colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#8dd1e1'];

interface ChartData {
  name: string;
  value: number;
}

interface DailyMetric {
  date: string;
  calls: number;
  errors: number;
  avgTime: number;
}

import { Socket } from 'socket.io-client';

interface WebSocketMessage {
  type: string;
  data?: any;
}

interface PieChartLabelProps {
  name: string;
  percent: number;
}

const Analytics = (): JSX.Element => {
  const [tabValue, setTabValue] = useState(0);
  // Initialize with empty objects first to avoid hydration errors
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({} as PerformanceMetrics);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics>({} as UserAnalytics);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t, language } = useLanguage();
  
  // Fallback translations if t function not available yet
  const loadingTexts = {
    performance: t ? t('analytics.loadingPerformanceData') : 'Loading performance metrics...',
    users: t ? t('analytics.loadingUserData') : 'Loading user analytics...',
  };

  // Function to fetch initial data
  const fetchInitialData = async () => {
    console.log('Fetching initial data...');
    setIsLoading(true);
    setError(null);

    try {
      // First check if the backend server is running
      const backendStatus = await checkBackendStatus();
      
      if (!backendStatus.isRunning) {
        setError(t('analytics.backendNotRunning'));
        console.error('Backend server is not running:', backendStatus.error);
        setIsLoading(false);
        return;
      }
      
      console.log('Backend server is running. Proceeding to fetch data...');
      
      // Fetch both data types in parallel for better performance
      const [performanceData, usersData] = await Promise.all([
        fetchAnalyticsPerformance().catch(err => {
          console.error('Error fetching performance data:', err);
          return null;
        }),
        fetchAnalyticsUsers().catch(err => {
          console.error('Error fetching user analytics data:', err);
          return null;
        })
      ]);
      
      console.log('Received performance data:', JSON.stringify(performanceData, null, 2));
      console.log('Received user analytics data:', JSON.stringify(usersData, null, 2));
      
      // Validate and log the structure of the data
      if (!usersData || !usersData.users) {
        console.warn('User analytics data is missing or has invalid structure:', usersData);
      } else {
        console.log(`Received data for ${Object.keys(usersData.users).length} users`);
      }
      
      // Create default data structures
      const defaultPerformanceData = {
        api_calls: 0,
        total_response_time: 0,
        average_response_time: 0,
        success_rate: 0,
        error_count: 0,
        daily_metrics: {}
      };
      
      const defaultUserData = {
        total_users: 0,
        active_users: 0,
        new_users: 0,
        users: {}
      };
      
      // Get current state to properly merge with new data
      // This prevents data from being cleared on refresh
      const currentPerformanceMetrics = { ...performanceMetrics };
      const currentUserAnalytics = { ...userAnalytics };
      
      // Ensure we have valid data structures by merging with current state
      const validPerformanceData = performanceData && typeof performanceData === 'object' 
        ? { 
            ...defaultPerformanceData, 
            ...currentPerformanceMetrics,
            ...performanceData,
            // Merge daily metrics instead of replacing
            daily_metrics: {
              ...currentPerformanceMetrics.daily_metrics,
              ...(performanceData.daily_metrics || {})
            }
          }
        : currentPerformanceMetrics || defaultPerformanceData;
      
      // For user analytics, we need to carefully merge the users object
      const validUserData = usersData && typeof usersData === 'object' && usersData.users
        ? { 
            ...defaultUserData, 
            ...currentUserAnalytics,
            ...usersData,
            // Merge users data instead of replacing
            users: {
              ...currentUserAnalytics.users,
              ...usersData.users
            }
          }
        : currentUserAnalytics || defaultUserData;
      
      console.log('Setting performance metrics:', JSON.stringify(validPerformanceData, null, 2));
      console.log('Setting user analytics:', JSON.stringify(validUserData, null, 2));
      
      // Set the data in state with validated data
      setPerformanceMetrics(validPerformanceData);
      setUserAnalytics(validUserData);
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('analytics_performance', JSON.stringify(validPerformanceData));
        localStorage.setItem('analytics_users', JSON.stringify(validUserData));
        console.log('Saved analytics data to localStorage');
      }
      
      // If both fetches returned null, show error
      if (!performanceData && !usersData) {
        setError('Failed to fetch analytics data. The endpoints may not be available or returning incorrect data.');
      }
    } catch (err) {
      setError('Failed to fetch analytics data. Please check the console for more details.');
      console.error('Error in fetchInitialData:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load data from localStorage on client-side only
  useEffect(() => {
    // Load from localStorage if available
    if (typeof window !== 'undefined') {
      const savedMetrics = localStorage.getItem('analytics_performance');
      if (savedMetrics) {
        try {
          const parsedMetrics = JSON.parse(savedMetrics);
          setPerformanceMetrics(parsedMetrics);
          console.log('Loaded performance metrics from localStorage');
        } catch (err) {
          console.error('Error parsing performance metrics from localStorage:', err);
          localStorage.removeItem('analytics_performance');
        }
      }
      
      const savedUsers = localStorage.getItem('analytics_users');
      if (savedUsers) {
        try {
          const parsedUsers = JSON.parse(savedUsers);
          setUserAnalytics(parsedUsers);
          console.log('Loaded user analytics from localStorage');
        } catch (err) {
          console.error('Error parsing user analytics from localStorage:', err);
          localStorage.removeItem('analytics_users');
        }
      }
    }
  }, []);

  useEffect(() => {
    let isSubscribed = true;
    let connectionCheckInterval: NodeJS.Timeout | null = null;
    
    // Define callback functions outside so we can reference them for unsubscribing
    const performanceCallback = (data: PerformanceMetrics) => {
      if (isSubscribed) {
        console.log('Received performance analytics update via WebSocket:', data);
        
        // Ensure we have valid data structure
        if (data && typeof data === 'object') {
          // Create a valid data structure by merging with current state
          const currentMetrics = performanceMetrics || {};
          const validData = {
            api_calls: data.api_calls || currentMetrics.api_calls || 0,
            total_response_time: data.total_response_time || currentMetrics.total_response_time || 0,
            average_response_time: data.average_response_time || currentMetrics.average_response_time || 0,
            success_rate: data.success_rate || currentMetrics.success_rate || 0,
            error_count: data.error_count || currentMetrics.error_count || 0,
            daily_metrics: {
              ...currentMetrics.daily_metrics,
              ...data.daily_metrics
            }
          };
          
          setPerformanceMetrics(validData);
          console.log('Updated performance metrics state');
          
          // Save to localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('analytics_performance', JSON.stringify(validData));
            console.log('Saved performance metrics to localStorage after WebSocket update');
          }
        } else {
          console.error('Invalid performance metrics data received from WebSocket:', data);
        }
      }
    };
    
    // User analytics callback for WebSocket updates
    const usersCallback = (data: UserAnalytics) => {
      if (isSubscribed) {
        console.log('Received user analytics via WebSocket:', data);
        console.log('User analytics structure:', {
          hasData: !!data,
          isObject: typeof data === 'object',
          totalUsers: data?.total_users,
          activeUsers: data?.active_users,
          newUsers: data?.new_users,
          usersCount: data?.users ? Object.keys(data.users).length : 0,
          userKeys: data?.users ? Object.keys(data.users) : []
        });
        
        if (data && typeof data === 'object') {
          // Ensure data has the expected structure
          const currentUserData = userAnalytics || {};
          const validData: UserAnalytics = {
            total_users: data.total_users || currentUserData.total_users || 0,
            active_users: data.active_users || currentUserData.active_users || 0,
            new_users: data.new_users || currentUserData.new_users || 0,
            users: {
              ...currentUserData.users,
              ...data.users
            }
          };
          
          console.log('Processed user analytics data:', validData);
          setUserAnalytics(validData);
          console.log('Updated user analytics state');
          
          // Save to localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('analytics_users', JSON.stringify(validData));
            console.log('Saved user analytics to localStorage after WebSocket update');
          }
        } else {
          console.error('Invalid user analytics data received from WebSocket:', data);
        }
      }
    };
    
    // Handle combined analytics update event
    const analyticsUpdateCallback = (data: {type: string, data: any}) => {
      if (isSubscribed) {
        console.log('Received combined analytics update via WebSocket:', data);
        console.log('Analytics update type:', data.type);
        console.log('Analytics update data structure:', {
          hasData: !!data.data,
          dataType: typeof data.data,
          hasUsers: data.data?.users ? true : false,
          hasPerformance: data.data?.performance ? true : false
        });
        
        if (data.type === 'users') {
          console.log('Processing users data from analytics_update event');
          usersCallback(data.data);
        } else if (data.type === 'performance') {
          console.log('Processing performance data from analytics_update event');
          performanceCallback(data.data);
        } else if (data.type === 'initial_data' && data.data) {
          console.log('Processing initial data from analytics_update event');
          // Handle initial data that contains both users and performance
          if (data.data.users) {
            console.log('Initial data contains users data');
            usersCallback(data.data.users);
          } else {
            console.log('Initial data does NOT contain users data');
          }
          
          if (data.data.performance) {
            console.log('Initial data contains performance data');
            performanceCallback(data.data.performance);
          } else {
            console.log('Initial data does NOT contain performance data');
          }
        } else if (data.type === 'user_insight_update') {
          console.log('Received user insight update, but this is not handled yet');
          // This might need to be implemented to handle individual user updates
        } else {
          console.log('Received unknown analytics update type:', data.type);
        }
      }
    };
    
    const connectionStatusCallback = (isConnected: boolean) => {
      if (isConnected) {
        console.log('Connected to analytics WebSocket');
        // Fetch initial data when connected
        void fetchInitialData();
      } else {
        console.log('Disconnected from analytics WebSocket');
        if (isSubscribed) {
          setError('WebSocket disconnected. Reconnecting...');
        }
      }
    };

    const initializeWebSocket = () => {
      try {
        // Connect to WebSocket service
        websocketService.connect();
        
        // Set up event handlers
        websocketService.onConnectionStatusChange(connectionStatusCallback);
        
        // Subscribe to analytics updates
        websocketService.subscribeToAnalyticsPerformance(performanceCallback);
        websocketService.subscribeToAnalyticsUsers(usersCallback);
        
        // Subscribe to custom analytics update event
        websocketService.on('analytics_update', analyticsUpdateCallback);
        
        // Explicitly request analytics data via WebSocket
        setTimeout(() => {
          if (websocketService.isConnected()) {
            console.log('Explicitly requesting analytics data via WebSocket...');
            // Use the new requestAnalyticsUpdate method instead of just subscribing
            websocketService.requestAnalyticsUpdate();
          } else {
            console.warn('WebSocket not connected, cannot request analytics data');
            // Fetch initial data via HTTP as a fallback if WebSocket is not connected
            void fetchInitialData();
          }
        }, 1000); // Wait for connection to establish
        
        return websocketService;
      } catch (err) {
        console.error('Error initializing WebSocket:', err);
        setError('Failed to initialize analytics service');
        // Fetch data via HTTP API as fallback
        void fetchInitialData();
        return null;
      }
    };

    // Initial data fetch via HTTP API
    void fetchInitialData();
    
    // Initialize WebSocket for real-time updates
    const ws = initializeWebSocket();

    // Set up connection check interval to periodically verify WebSocket status and request fresh data
    connectionCheckInterval = setInterval(() => {
      if (isSubscribed && websocketService) {
        if (websocketService.isConnected()) {
          console.log('WebSocket connection check: Connected');
          // Request fresh analytics data every 30 seconds to ensure data is up-to-date
          websocketService.requestAnalyticsUpdate();
        } else {
          console.warn('WebSocket connection check: Disconnected');
          // Try to reconnect
          websocketService.connect();
          // Fallback to HTTP API if WebSocket is disconnected
          void fetchInitialData();
        }
      }
    }, 30000); // Check every 30 seconds
    
    return () => {
      isSubscribed = false;
      // Clear the connection check interval
      if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
      }
      
      // Properly cleanup WebSocket subscriptions
      if (websocketService) {
        // Unsubscribe from analytics events using the same callback references
        websocketService.unsubscribeFromAnalyticsPerformance(performanceCallback);
        websocketService.unsubscribeFromAnalyticsUsers(usersCallback);
        websocketService.off('analytics_update', analyticsUpdateCallback);
        console.log('Unsubscribed from all analytics WebSocket events');
      }
    };
  }, []);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const renderPerformanceMetrics = (): JSX.Element => {
    console.log('Rendering performance metrics with data:', performanceMetrics);
    
    if (!performanceMetrics || Object.keys(performanceMetrics).length === 0) {
      console.warn('No performance metrics data available for rendering');
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">No performance data available</div>
        </div>
      );
    }
    
    // Log the daily metrics data for debugging
    console.log('Daily metrics data:', performanceMetrics.daily_metrics);
    console.log('Daily metrics keys:', Object.keys(performanceMetrics.daily_metrics || {}));

    // Ensure we have daily metrics data, even if it's empty
    const dailyMetrics = performanceMetrics.daily_metrics || {};
    
    // Create a default entry for today if no data exists
    if (Object.keys(dailyMetrics).length === 0) {
      console.log('No daily metrics data available, creating default entry for today');
      const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
      dailyMetrics[today] = {
        api_calls: 0,
        error_count: 0,
        total_response_time: 0
      };
    }
    
    // Map the daily metrics to chart data
    const dailyData = Object.entries(dailyMetrics).map(([date, metrics]) => {
      console.log(`Processing daily data for ${date}:`, metrics);
      return {
        date: format(new Date(date), 'MM/dd'),
        calls: metrics.api_calls || 0,
        errors: metrics.error_count || 0,
        avgTime: metrics.api_calls > 0 ? metrics.total_response_time / metrics.api_calls : 0
      };
    });

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
            <div className="text-gray-600 text-sm mb-2">{t('analytics.totalApiCalls')}</div>
            <div className="text-2xl font-semibold">{performanceMetrics.api_calls || 0}</div>
          </div>
          <div className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
            <div className="text-gray-600 text-sm mb-2">{t('analytics.successRate')}</div>
            <div className="text-2xl font-semibold">
              {((performanceMetrics.success_rate || 0) * 100).toFixed(1)}%
            </div>
          </div>
          <div className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
            <div className="text-gray-600 text-sm mb-2">{t('analytics.avgResponseTime')}</div>
            <div className="text-2xl font-semibold">
              {(performanceMetrics.average_response_time || 0).toFixed(2)}{language === 'en' ? 's' : ' detik'}
            </div>
          </div>
          <div className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
            <div className="text-gray-600 text-sm mb-2">{t('analytics.errorCount')}</div>
            <div className="text-2xl font-semibold">{performanceMetrics.error_count || 0}</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-4">{t('analytics.dailyPerformance')}</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <ChartTooltip />
                <Line yAxisId="left" type="monotone" dataKey="calls" name={t('analytics.apiCalls')} stroke="#0088FE" />
                <Line yAxisId="left" type="monotone" dataKey="errors" name={t('analytics.errors')} stroke="#FF8042" />
                <Line yAxisId="right" type="monotone" dataKey="avgTime" name={language === 'en' ? 'Avg Time (s)' : 'Waktu Rata-rata (detik)'} stroke="#00C49F" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  const renderUserTable = (): JSX.Element | null => {
    console.log('Rendering user table with data:', userAnalytics);
    if (!userAnalytics?.users || Object.keys(userAnalytics.users).length === 0) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">{t('analytics.noUserData')}</div>
        </div>
      );
    }
    
    // Debug the data structure
    console.log('User analytics data structure:', JSON.stringify(userAnalytics, null, 2));

    return (
      <div className="mt-6 overflow-x-auto">
        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-gray-600 text-sm mb-2">{t('analytics.totalUsers')}</div>
            <div className="text-2xl font-semibold">{userAnalytics.total_users || 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-gray-600 text-sm mb-2">{t('analytics.activeUsers')}</div>
            <div className="text-2xl font-semibold">{userAnalytics.active_users || 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-gray-600 text-sm mb-2">{t('analytics.newUsers')}</div>
            <div className="text-2xl font-semibold">{userAnalytics.new_users || 0}</div>
          </div>
        </div>
        
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('analytics.whatsappNumber')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('analytics.name')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('analytics.age')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('analytics.location')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('analytics.gender')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('analytics.complaints')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('analytics.barriers')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('analytics.lastInteraction')}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Object.entries(userAnalytics.users || {}).map(([phone, userData]: [string, any]) => {
              // Debug the user data structure
              console.log(`User data for ${phone}:`, userData);
              
              // Safely access user data properties with fallbacks
              const details = userData.details || {};
              const latestAnalysis = userData.latest_analysis || {};
              
              // Try to get data from either details or latest_analysis
              const name = details.name || latestAnalysis.name || 'N/A';
              const age = details.age || latestAnalysis.age || 'N/A';
              const location = details.location || latestAnalysis.location || 'N/A';
              const gender = details.gender || latestAnalysis.gender || null;
              
              // Get health complaints from either source with better validation
              let healthComplaints: string[] = [];
              try {
                // Helper function to safely filter and process array items
                const processArray = (arr: unknown[]): string[] => {
                  // Filter out single character entries that are likely errors
                  return arr
                    .filter((item): item is string | number | boolean => 
                      item !== null && item !== undefined)
                    .map(item => String(item).trim())
                    .filter(item => item.length > 1) // Only keep items with length > 1 character
                    .filter(item => !/^[a-zA-Z]$/.test(item)); // Remove single letters
                };
                
                if (details.health_complaints && Array.isArray(details.health_complaints)) {
                  healthComplaints = processArray(details.health_complaints);
                } else if (latestAnalysis.health_complaints && Array.isArray(latestAnalysis.health_complaints)) {
                  healthComplaints = processArray(latestAnalysis.health_complaints);
                } else if (latestAnalysis.jenis_keluhan) {
                  // Handle old format
                  if (typeof latestAnalysis.jenis_keluhan === 'string') {
                    const value = latestAnalysis.jenis_keluhan.trim();
                    if (value.length > 1) { // Only keep if more than 1 character
                      healthComplaints = [value];
                    }
                  } else if (Array.isArray(latestAnalysis.jenis_keluhan)) {
                    healthComplaints = processArray(latestAnalysis.jenis_keluhan);
                  }
                }
                
                // Remove any remaining single character entries
                healthComplaints = healthComplaints.filter(item => item.length > 1);
                
                console.log(`Processed health complaints for ${phone}:`, healthComplaints);
              } catch (error) {
                console.error(`Error processing health complaints for ${phone}:`, error);
                healthComplaints = [];
              }
              
              // Get conversion barriers from either source with better validation
              let barriers: string[] = [];
              try {
                // Helper function to safely filter and process array items
                const processArray = (arr: unknown[]): string[] => {
                  // Filter out single character entries that are likely errors
                  return arr
                    .filter((item): item is string | number | boolean => 
                      item !== null && item !== undefined)
                    .map(item => String(item).trim())
                    .filter(item => item.length > 1) // Only keep items with length > 1 character
                    .filter(item => !/^[a-zA-Z]$/.test(item)); // Remove single letters
                };
                
                if (details.conversion_barriers && Array.isArray(details.conversion_barriers)) {
                  barriers = processArray(details.conversion_barriers);
                } else if (latestAnalysis.conversion_barriers && Array.isArray(latestAnalysis.conversion_barriers)) {
                  barriers = processArray(latestAnalysis.conversion_barriers);
                }
                
                // Remove any remaining single character entries
                barriers = barriers.filter(item => item.length > 1);
                
                console.log(`Processed barriers for ${phone}:`, barriers);
              } catch (error) {
                console.error(`Error processing barriers for ${phone}:`, error);
                barriers = [];
              }
              
              // Get last interaction time
              let lastInteraction;
              try {
                lastInteraction = details.last_interaction || userData.details?.last_interaction || new Date().toISOString();
                // Make sure it's a valid date
                new Date(lastInteraction);
              } catch (e) {
                console.error(`Invalid date for ${phone}:`, lastInteraction);
                lastInteraction = new Date().toISOString();
              }
              
              console.log(`Extracted data for ${phone}:`, { 
                name, 
                age, 
                location, 
                gender, 
                healthComplaints, 
                barriers,
                lastInteraction 
              });
              
              return (
                <tr key={phone} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{phone}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{age}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{location}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{gender}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {healthComplaints.length > 0 ? (
                      <div className="space-y-2">
                        {healthComplaints.map((complaint: string, index: number) => (
                          <div key={index} className="flex items-start space-x-2 bg-blue-50 p-2 rounded-md">
                            <div className="flex-shrink-0 w-3 h-3 mt-1.5 rounded-full bg-blue-500"></div>
                            <div className="flex-1 font-medium">{complaint}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-500 italic">{t('analytics.noComplaints')}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {barriers.length > 0 ? (
                      <div className="space-y-2">
                        {barriers.map((barrier: string, index: number) => (
                          <div key={index} className="flex items-start space-x-2 bg-orange-50 p-2 rounded-md">
                            <div className="flex-shrink-0 w-3 h-3 mt-1.5 rounded-full bg-orange-500"></div>
                            <div className="flex-1 font-medium">{barrier}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-500 italic">{t('analytics.noBarriers')}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(lastInteraction), 'dd MMM yyyy HH:mm')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderUserAnalytics = (): JSX.Element => {
    console.log('Rendering user analytics with data:', userAnalytics);
    
    if (!userAnalytics || !userAnalytics.users) {
      console.warn('No user analytics data available for rendering');
      return <div className="p-4">{t('analytics.loadingUserAnalytics')}</div>;
    }
    
    // Log user data for debugging
    console.log('User analytics users:', Object.keys(userAnalytics.users || {}));
    console.log('User count:', Object.keys(userAnalytics.users || {}).length);

    // Ensure we have valid data
    const users = userAnalytics.users || {};
    const userCount = Object.keys(users).length;
    const activeUsers = userAnalytics.active_users || 0;
    const newUsers = userAnalytics.new_users || 0;

    // Create maps for pie charts
    const genderMap = new Map<string, number>();
    const locationMap = new Map<string, number>();
    const urgencyMap = new Map<string, number>();
    const healthIssueMap = new Map<string, number>();
    const emotionMap = new Map<string, number>();
    
    // Set default values if no data is available
    if (userCount === 0) {
      console.log('No user data available, setting default values for charts');
      genderMap.set('unknown', 1);
      locationMap.set('unknown', 1);
      urgencyMap.set('unknown', 1);
      healthIssueMap.set('Unknown', 1);
      emotionMap.set('unknown', 1);
    }
    
    // Debug the structure of userAnalytics
    console.log('User Analytics Structure:', JSON.stringify(userAnalytics, null, 2));

    // Aggregate data from user analytics
    try {
      Object.values(userAnalytics.users || {}).forEach((userData: any) => {
        if (!userData) {
          console.log('Skipping null/undefined userData');
          return; // Skip if userData is null or undefined
        }
        
        // Safely access properties with fallbacks
        const latestAnalysis = userData.latest_analysis || {};
        const details = userData.details || {};
        
        // Debug individual user data
        console.log('Processing user data:', userData);
        console.log('Latest analysis:', latestAnalysis);
        console.log('Details:', details);
        
        // Gender distribution - normalize values
        let gender = 'unknown';
        if (latestAnalysis.gender) {
          gender = String(latestAnalysis.gender).toLowerCase();
        } else if (details.gender) {
          gender = String(details.gender).toLowerCase();
        }
        
        const normalizedGender = 
          gender === 'male' || gender === 'laki-laki' || gender === 'laki' || gender === 'pria' ? 'male' :
          gender === 'female' || gender === 'perempuan' || gender === 'wanita' ? 'female' : 'unknown';
        
        console.log(`Normalized gender: ${gender} -> ${normalizedGender}`);
        genderMap.set(normalizedGender, (genderMap.get(normalizedGender) || 0) + 1);
        
        // Location distribution
        const location = latestAnalysis.location || details.location || 'unknown';
        locationMap.set(location, (locationMap.get(location) || 0) + 1);
        
        // Urgency level distribution - normalize values
        let urgency = 'unknown';
        if (latestAnalysis.urgency_level) {
          urgency = String(latestAnalysis.urgency_level).toLowerCase();
        } else if (latestAnalysis.tingkat_urgensi) {
          urgency = String(latestAnalysis.tingkat_urgensi).toLowerCase();
        }
        
        const normalizedUrgency = 
          urgency === 'high' || urgency === 'tinggi' ? 'high' :
          urgency === 'medium' || urgency === 'sedang' ? 'medium' :
          urgency === 'low' || urgency === 'rendah' ? 'low' : 'unknown';
        
        console.log(`Normalized urgency: ${urgency} -> ${normalizedUrgency}`);
        urgencyMap.set(normalizedUrgency, (urgencyMap.get(normalizedUrgency) || 0) + 1);
        
        // Health issue distribution
        let healthComplaints: string[] = [];
        if (Array.isArray(latestAnalysis.health_complaints) && latestAnalysis.health_complaints.length > 0) {
          healthComplaints = latestAnalysis.health_complaints;
        } else if (Array.isArray(details.health_complaints) && details.health_complaints.length > 0) {
          healthComplaints = details.health_complaints;
        } else if (latestAnalysis.jenis_keluhan) {
          // Handle old format
          if (typeof latestAnalysis.jenis_keluhan === 'string') {
            healthComplaints = [latestAnalysis.jenis_keluhan];
          } else if (Array.isArray(latestAnalysis.jenis_keluhan)) {
            healthComplaints = latestAnalysis.jenis_keluhan;
          }
        }
        
        console.log(`Health complaints:`, healthComplaints);
        
        if (healthComplaints.length > 0) {
          healthComplaints.forEach((complaint: string) => {
            if (complaint && complaint.trim()) {
              healthIssueMap.set(complaint, (healthIssueMap.get(complaint) || 0) + 1);
            }
          });
        } else {
          healthIssueMap.set('Unknown', (healthIssueMap.get('Unknown') || 0) + 1);
        }
        
        // Emotion distribution - normalize values
        let emotion = 'unknown';
        if (latestAnalysis.emotion) {
          emotion = String(latestAnalysis.emotion).toLowerCase();
        } else if (latestAnalysis.emosi) {
          emotion = String(latestAnalysis.emosi).toLowerCase();
        }
        
        const normalizedEmotion = 
          emotion === 'positive' || emotion === 'positif' ? 'positive' :
          emotion === 'negative' || emotion === 'negatif' ? 'negative' :
          emotion === 'neutral' || emotion === 'netral' ? 'neutral' : 'unknown';
        
        console.log(`Normalized emotion: ${emotion} -> ${normalizedEmotion}`);
        emotionMap.set(normalizedEmotion, (emotionMap.get(normalizedEmotion) || 0) + 1);
      });
      
      // Log the aggregated data
      console.log('Aggregated gender data:', Object.fromEntries(genderMap));
      console.log('Aggregated location data:', Object.fromEntries(locationMap));
      console.log('Aggregated urgency data:', Object.fromEntries(urgencyMap));
      console.log('Aggregated health issue data:', Object.fromEntries(healthIssueMap));
      console.log('Aggregated emotion data:', Object.fromEntries(emotionMap));
      
    } catch (error) {
      console.error('Error processing user analytics data:', error);
      // Set default values if there's an error
      if (genderMap.size === 0) genderMap.set('unknown', 1);
      if (locationMap.size === 0) locationMap.set('unknown', 1);
      if (urgencyMap.size === 0) urgencyMap.set('unknown', 1);
      if (healthIssueMap.size === 0) healthIssueMap.set('Unknown', 1);
      if (emotionMap.size === 0) emotionMap.set('unknown', 1);
    }

    const healthIssueData: ChartData[] = Array.from(healthIssueMap).map(([name, value]) => ({ name, value }));
    // Transform data for charts with proper labels based on language
    const emotionData: ChartData[] = Array.from(emotionMap).map(([name, value]) => ({ 
      name: name === 'positive' ? (language === 'en' ? 'Positive' : 'Positif') :
            name === 'negative' ? (language === 'en' ? 'Negative' : 'Negatif') :
            name === 'neutral' ? (language === 'en' ? 'Neutral' : 'Netral') :
            name === 'unknown' ? (language === 'en' ? 'Unknown' : 'Tidak Diketahui') : name,
      value 
    }));
    
    const urgencyData: ChartData[] = Array.from(urgencyMap).map(([name, value]) => ({ 
      name: name === 'high' ? (language === 'en' ? 'High' : 'Tinggi') :
            name === 'medium' ? (language === 'en' ? 'Medium' : 'Sedang') :
            name === 'low' ? (language === 'en' ? 'Low' : 'Rendah') :
            name === 'unknown' ? (language === 'en' ? 'Unknown' : 'Tidak Diketahui') : name,
      value 
    }));
    
    const genderData: ChartData[] = Array.from(genderMap).map(([name, value]) => ({
      name: name === 'male' ? (language === 'en' ? 'Male' : 'Laki-laki') :
            name === 'female' ? (language === 'en' ? 'Female' : 'Perempuan') :
            name === 'unknown' ? (language === 'en' ? 'Unknown' : 'Tidak Diketahui') : name,
      value
    }));

    // Helper function to render pie charts
    const renderPieChart = (data: ChartData[], title: string): JSX.Element => {
      // Ensure data is not empty
      if (!data || data.length === 0) {
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">{title}</h3>
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-gray-500">No data available</p>
            </div>
          </div>
        );
      }
      
      return (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">{title}</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }: PieChartLabelProps) => 
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
            <div className="text-gray-600 text-sm mb-2">Total Users</div>
            <div className="text-2xl font-semibold">{userCount}</div>
          </div>
          <div className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
            <div className="text-gray-600 text-sm mb-2">Active Users (7d)</div>
            <div className="text-2xl font-semibold">{activeUsers}</div>
          </div>
          <div className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
            <div className="text-gray-600 text-sm mb-2">High Urgency Cases</div>
            <div className="text-2xl font-semibold">
              {urgencyData.find((item) => item.name === 'Tinggi')?.value || 0}
            </div>
          </div>
        </div>

        {/* Pie Charts - First Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {renderPieChart(genderData, t('analytics.genderDistribution'))}
          {renderPieChart(urgencyData, t('analytics.urgencyDistribution'))}
        </div>
        
        {/* Pie Charts - Second Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderPieChart(healthIssueData, t('analytics.complaintsDistribution'))}
          {renderPieChart(emotionData, t('analytics.emotionDistribution'))}
        </div>
      </div>
    );
  };

  // Render error state with retry button
  const renderError = () => {
    return (
      <div className="flex flex-col items-center justify-center h-64 p-6 bg-red-50 rounded-lg">
        <div className="text-red-500 mb-4 text-xl">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
        <p className="text-gray-600 mb-4 text-center">
          {t('analytics.unableToConnect')}
        </p>
        <button 
          onClick={() => fetchInitialData()} 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t('analytics.retrying')}
            </>
          ) : (
            t('analytics.retryConnection')
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-2">{t('analytics.title')}</h1>
          <p className="text-gray-600">
            {language === 'en' ? 'Monitor and analyze your WhatsApp chatbot performance' : 'Pantau dan analisis kinerja chatbot WhatsApp Anda'}
          </p>
        </div>

        <div className="flex justify-between items-center mb-6">
          <button 
            onClick={() => fetchInitialData()} 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('analytics.refreshing')}
              </>
            ) : (
              t('analytics.refreshData')
            )}
          </button>
        </div>

        <div className="flex justify-center mb-6">
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label={t('analytics.performanceMetrics')} />
            <Tab label={t('analytics.userAnalytics')} />
          </Tabs>
        </div>

        {error ? (
          renderError()
        ) : (
          <div className="mt-4">
            {tabValue === 0 ? (
              isLoading ? (
                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-lg shadow-sm p-6">
                  <CircularProgress size={60} thickness={4} />
                  <p className="mt-4 text-gray-600 font-medium">{t('analytics.loadingPerformanceData')}</p>
                </div>
              ) : renderPerformanceMetrics()
            ) : (
              isLoading ? (
                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-lg shadow-sm p-6">
                  <CircularProgress size={60} thickness={4} />
                  <p className="mt-4 text-gray-600 font-medium">{t('analytics.loadingUserData')}</p>
                </div>
              ) : (
                <div>
                  {renderUserAnalytics()}
                  {renderUserTable()}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
