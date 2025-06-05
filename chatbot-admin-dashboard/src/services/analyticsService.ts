import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Function to check if the backend server is running
export async function checkBackendStatus() {
  try {
    console.log(`Checking backend status at ${API_BASE_URL}`);
    const response = await axios.get(`${API_BASE_URL}/health`, {
      timeout: 5000 // 5 second timeout
    });
    return { isRunning: true, status: response.status };
  } catch (error) {
    console.error('Backend server check failed:', error);
    return { isRunning: false, error };
  }
}

export async function fetchAnalyticsPerformance(days = 7) {
  try {
    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();
    console.log(`Fetching analytics performance data from ${API_BASE_URL}/admin/analytics/performance`);
    
    const response = await axios.get(`${API_BASE_URL}/admin/analytics/performance`, {
      params: { days, timestamp },
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Content-Type': 'application/json'
      },
      timeout: 10000, // 10 second timeout
      withCredentials: true // Include credentials for CORS
    });
    
    console.log('Analytics performance API response status:', response.status);
    console.log('Analytics performance response data:', JSON.stringify(response.data, null, 2));
    
    // Normalize the response data structure to match the expected format
    const normalizedData = {
      api_calls: response.data.api_calls || 0,
      total_response_time: response.data.total_response_time || 0,
      average_response_time: response.data.average_response_time || 0,
      success_rate: response.data.success_rate || 0,
      error_count: response.data.error_count || 0,
      daily_metrics: response.data.daily_metrics || {}
    };
    
    console.log('Normalized performance data:', JSON.stringify(normalizedData, null, 2));
    console.log('Daily metrics count:', Object.keys(normalizedData.daily_metrics || {}).length);
    
    return normalizedData;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Axios error fetching performance data:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        headers: error.config?.headers
      });
      
      // Check for CORS errors
      if (error.message.includes('Network Error') || error.message.includes('CORS')) {
        console.error('Possible CORS issue. Check backend CORS configuration.');
      }
    } else {
      console.error('Unknown error fetching performance data:', error);
    }
    
    // Return default data instead of throwing
    return {
      api_calls: 0,
      total_response_time: 0,
      average_response_time: 0,
      success_rate: 0,
      error_count: 0,
      daily_metrics: {}
    };
  }
}

export async function fetchAnalyticsUsers(sender?: string) {
  try {
    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();
    const url = sender 
      ? `${API_BASE_URL}/admin/analytics/users/${sender}/history`
      : `${API_BASE_URL}/admin/analytics/users`;
    
    console.log(`Fetching analytics users data from ${url}`);
    
    const response = await axios.get(url, {
      params: { timestamp },
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 15000, // 15 second timeout
      withCredentials: true // Include credentials for CORS
    });
    
    console.log('Analytics users API response status:', response.status);
    console.log('Analytics users response headers:', response.headers);
    console.log('Analytics users raw data type:', typeof response.data);
    
    // Validate response data structure
    if (!response.data) {
      console.error('Empty response data');
      return {
        total_users: 0,
        active_users: 0,
        new_users: 0,
        users: {}
      };
    }
    
    // Handle if response.data is a string (sometimes happens with some JSON parsing issues)
    let parsedData = response.data;
    if (typeof parsedData === 'string') {
      try {
        parsedData = JSON.parse(parsedData);
        console.log('Parsed string data into object');
      } catch (e) {
        console.error('Failed to parse string data:', e);
        parsedData = {};
      }
    }
    
    // Ensure users object exists and is valid
    if (!parsedData.users || typeof parsedData.users !== 'object') {
      console.warn('Users data is missing or invalid:', parsedData.users);
      parsedData.users = {};
      
      // Try to extract users from structure if it exists elsewhere
      if (parsedData.data && typeof parsedData.data === 'object') {
        console.log('Attempting to extract users from data property');
        parsedData.users = parsedData.data.users || {};
      }
    }
    
    // Normalize the response data structure to match the expected format
    const normalizedData = {
      total_users: parsedData.total_users || 0,
      active_users: parsedData.active_users || 0,
      new_users: parsedData.new_users || 0,
      users: parsedData.users || {}
    };
    
    console.log('Normalized analytics users data structure:', 
      Object.keys(normalizedData), 
      'Users count:', Object.keys(normalizedData.users).length);
    
    // Debug first user if available
    const userKeys = Object.keys(normalizedData.users);
    if (userKeys.length > 0) {
      const firstUserKey = userKeys[0];
      console.log('Sample user data structure:', 
        Object.keys(normalizedData.users[firstUserKey]));
    }
    
    return normalizedData;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Axios error fetching users data:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        headers: error.config?.headers
      });
      
      // Check for CORS errors
      if (error.message.includes('Network Error') || error.message.includes('CORS')) {
        console.error('Possible CORS issue. Check backend CORS configuration.');
      }
      
      // Return a default structure instead of throwing
      return {
        total_users: 0,
        active_users: 0,
        new_users: 0,
        users: {}
      };
    } else {
      console.error('Unknown error fetching users data:', error);
      // Return a default structure instead of throwing
      return {
        total_users: 0,
        active_users: 0,
        new_users: 0,
        users: {}
      };
    }
  }
}
