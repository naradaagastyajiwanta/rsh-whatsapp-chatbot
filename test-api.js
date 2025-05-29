// Simple script to test the API endpoints
const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000';

async function testAnalyticsEndpoints() {
  console.log('Testing Analytics API Endpoints...');
  
  try {
    // Test performance endpoint
    console.log('\nTesting /admin/analytics/performance endpoint:');
    const performanceResponse = await axios.get(`${API_BASE_URL}/admin/analytics/performance`);
    console.log('Status:', performanceResponse.status);
    console.log('Data:', JSON.stringify(performanceResponse.data, null, 2));
  } catch (error) {
    console.error('Error testing performance endpoint:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
  
  try {
    // Test users endpoint
    console.log('\nTesting /admin/analytics/users endpoint:');
    const usersResponse = await axios.get(`${API_BASE_URL}/admin/analytics/users`);
    console.log('Status:', usersResponse.status);
    console.log('Data:', JSON.stringify(usersResponse.data, null, 2));
  } catch (error) {
    console.error('Error testing users endpoint:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Run the tests
testAnalyticsEndpoints();
