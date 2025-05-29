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
        'Content-Type': 'application/json'
      },
      timeout: 10000, // 10 second timeout
      withCredentials: true // Include credentials for CORS
    });
    
    console.log('Analytics users API response status:', response.status);
    console.log('Analytics users response data:', JSON.stringify(response.data, null, 2));
    
    // Validate response data structure
    if (!response.data || typeof response.data !== 'object') {
      console.error('Invalid analytics users response format:', response.data);
      throw new Error('Invalid response format from analytics users API');
    }
    
    // Normalize the response data structure to match the expected format
    const normalizedData = {
      total_users: response.data.total_users || 0,
      active_users: response.data.active_users || 0,
      new_users: response.data.new_users || 0,
      users: response.data.users || {}
    };
    
    console.log('Normalized analytics users data:', JSON.stringify(normalizedData, null, 2));
    console.log('Users count:', Object.keys(normalizedData.users || {}).length);
    
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
