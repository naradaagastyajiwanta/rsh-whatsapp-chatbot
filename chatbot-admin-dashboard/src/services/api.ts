import axios from 'axios';
import { Chat, ChatStats, Message } from '@/types/chat';

// Define API base URL
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Interface for sending messages
interface SendMessageRequest {
  recipient: string;
  message: string;
  useBot: boolean;
}

// Create an axios instance with base URL
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,   // Penting untuk CORS dengan credentials
});

// Function to fetch all chats
export const fetchChats = async (): Promise<Chat[]> => {
  try {
    console.log('Fetching chats from API...');
    const response = await fetch(`${API_BASE_URL}/admin/chats`);
    
    if (!response.ok) {
      console.warn(`API returned status ${response.status}: ${response.statusText}`);
      throw new Error(`Failed to fetch chats: ${response.status} ${response.statusText}`);
    }
    
    let chats = await response.json();
    console.log('Raw API response:', chats);
    
    // Handle different response formats
    // If response is an array, use it directly
    // If response has a 'chats' property, use that
    if (!Array.isArray(chats) && chats.chats) {
      console.log('Response has chats property, using that');
      chats = chats.chats;
    } else if (!Array.isArray(chats)) {
      console.error('Unexpected response format:', chats);
      throw new Error('Unexpected response format');
    }
    
    // Ensure each chat has the required properties
    const validatedChats = chats.map((chat: any) => {
      // Ensure required properties exist
      return {
        id: chat.id || `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        sender: chat.sender || 'unknown',
        senderName: chat.senderName || chat.sender_name || 'Unknown User',
        lastMessage: chat.lastMessage || chat.last_message || 'No messages',
        lastTimestamp: chat.lastTimestamp || chat.last_timestamp || new Date().toISOString(),
        messages: Array.isArray(chat.messages) ? chat.messages : [],
        botEnabled: typeof chat.botEnabled === 'boolean' ? chat.botEnabled : true,
        unansweredCount: typeof chat.unansweredCount === 'number' ? chat.unansweredCount : 0
      };
    });
    
    console.log('Validated chats:', validatedChats);
    
    // Fetch bot status and unanswered count for each chat
    try {
      const chatsWithStatus = await Promise.all(validatedChats.map(async (chat: Chat) => {
        try {
          const statusResponse = await fetch(`${API_BASE_URL}/admin/bot-status/${chat.id}`);
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            return {
              ...chat,
              botEnabled: statusData.botEnabled,
              unansweredCount: statusData.unansweredCount || 0
            };
          }
          return chat;
        } catch (err) {
          console.error(`Error fetching status for chat ${chat.id}:`, err);
          return chat;
        }
      }));
      
      console.log('Chats with status:', chatsWithStatus);
      return chatsWithStatus;
    } catch (statusError) {
      console.error('Error fetching bot status:', statusError);
      return validatedChats;
    }
  } catch (error) {
    console.error('Error fetching chats:', error);
    // Fall back to mock data if the API fails
    console.log('Falling back to mock data');
    return mockChats;
  }
};

// Function to fetch a specific chat by ID
export const fetchChatById = async (id: string): Promise<Chat> => {
  try {
    // Call the Flask backend API
    const response = await api.get(`/admin/chats/${id}`);
    const chat = response.data;
    
    // Also fetch bot status and unanswered count
    try {
      const statusResponse = await fetch(`${API_BASE_URL}/admin/bot-status/${id}`);
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        return {
          ...chat,
          botEnabled: statusData.botEnabled,
          unansweredCount: statusData.unansweredCount || 0
        };
      }
      return chat;
    } catch (err) {
      console.error(`Error fetching status for chat ${id}:`, err);
      return chat;
    }
  } catch (error) {
    console.error(`Error fetching chat ${id}:`, error);
    
    // Fall back to mock data if the API fails
    console.log('Falling back to mock data');
    const chat = mockChats.find(chat => chat.id === id);
    if (!chat) {
      throw new Error('Chat not found');
    }
    return chat;
  }
};

// Function to fetch chat statistics
export const fetchChatStats = async (): Promise<ChatStats> => {
  try {
    // Call the Flask backend API
    const response = await api.get('/admin/stats');
    return response.data;
  } catch (error) {
    console.error('Error fetching chat stats:', error);
    // Fall back to mock data if the API fails
    console.log('Falling back to mock data');
    return mockStats;
  }
};

// Function to search chats
export const searchChats = async (query: string): Promise<Chat[]> => {
  try {
    const response = await api.get(`/admin/search-chats?query=${encodeURIComponent(query)}`);
    let chats = response.data;
    
    // Handle different response formats
    // If response is an array, use it directly
    // If response has a 'chats' property, use that
    if (!Array.isArray(chats) && chats.chats) {
      chats = chats.chats;
    }
    
    // Fetch bot status and unanswered count for each chat
    const chatsWithStatus = await Promise.all(chats.map(async (chat: Chat) => {
      try {
        const statusResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/admin/bot-status/${chat.id}`);
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          return {
            ...chat,
            botEnabled: statusData.botEnabled,
            unansweredCount: statusData.unansweredCount || 0
          };
        }
        return chat;
      } catch (err) {
        console.error(`Error fetching status for chat ${chat.id}:`, err);
        return chat;
      }
    }));
    
    return chatsWithStatus;
  } catch (error) {
    console.error('Error searching chats:', error);
    // Fall back to mock data if the API fails
    console.log('Falling back to mock search');
    // Simple client-side search implementation as fallback
    if (!query.trim()) return mockChats;
    
    const normalizedQuery = query.toLowerCase();
    return mockChats.filter(chat => 
      chat.sender.toLowerCase().includes(normalizedQuery) ||
      (chat.senderName?.toLowerCase() || '').includes(normalizedQuery) ||
      chat.lastMessage.toLowerCase().includes(normalizedQuery)
    );
  }
};

// Function to send a message to a recipient
export const sendMessage = async (data: SendMessageRequest): Promise<any> => {
  try {
    // Call the Flask backend API
    const response = await api.post('/admin/send-message', data);
    return response.data;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

// Function to toggle bot status for a specific chat
export const toggleBotStatus = async (chatId: string, enabled: boolean): Promise<any> => {
  try {
    // Call the Flask backend API
    const response = await api.post(`/admin/toggle-bot/${chatId}`, { enabled });
    return response.data;
  } catch (error) {
    console.error('Error toggling bot status:', error);
    throw error;
  }
};

// Mock data for development
const mockChats: Chat[] = [
  {
    id: '1',
    sender: '6281234567890@s.whatsapp.net',
    senderName: 'John Doe',
    lastMessage: 'Apa itu program 7 hari menuju sehat raga dan jiwa?',
    lastTimestamp: '2025-05-25T10:30:00Z',
    messages: [
      {
        id: '1-1',
        content: 'Apa itu program 7 hari menuju sehat raga dan jiwa?',
        timestamp: '2025-05-25T10:30:00Z',
        isFromUser: true,
      },
      {
        id: '1-2',
        content: 'Program 7 Hari Menuju Sehat Raga & Jiwa adalah program intensif yang dirancang oleh RSH Satu Bumi untuk membantu Anda mencapai keseimbangan fisik dan mental dalam waktu singkat. Program ini mencakup kombinasi terapi holistik, pola makan sehat, meditasi, dan aktivitas fisik yang disesuaikan dengan kebutuhan individu.',
        timestamp: '2025-05-25T10:30:15Z',
        isFromUser: false,
      },
    ],
  },
  {
    id: '2',
    sender: '6289876543210@s.whatsapp.net',
    senderName: 'Jane Smith',
    lastMessage: 'Bagaimana cara mendaftar untuk konsultasi kesehatan?',
    lastTimestamp: '2025-05-25T09:45:00Z',
    messages: [
      {
        id: '2-1',
        content: 'Halo, saya ingin bertanya tentang layanan konsultasi kesehatan',
        timestamp: '2025-05-25T09:44:00Z',
        isFromUser: true,
      },
      {
        id: '2-2',
        content: 'Tentu, kami menyediakan layanan konsultasi kesehatan holistik. Ada yang bisa saya bantu?',
        timestamp: '2025-05-25T09:44:15Z',
        isFromUser: false,
      },
      {
        id: '2-3',
        content: 'Bagaimana cara mendaftar untuk konsultasi kesehatan?',
        timestamp: '2025-05-25T09:45:00Z',
        isFromUser: true,
      },
      {
        id: '2-4',
        content: 'Untuk mendaftar konsultasi kesehatan, Anda dapat menghubungi kami di nomor (021) 12345678 atau melalui email di info@rshsatubumi.com. Kami akan membantu Anda menjadwalkan sesi konsultasi sesuai dengan kebutuhan Anda.',
        timestamp: '2025-05-25T09:45:30Z',
        isFromUser: false,
      },
    ],
  },
  {
    id: '3',
    sender: '6287654321098@s.whatsapp.net',
    senderName: 'Robert Johnson',
    lastMessage: 'Terima kasih atas informasinya!',
    lastTimestamp: '2025-05-25T08:15:00Z',
    messages: [
      {
        id: '3-1',
        content: 'Apakah ada program detoksifikasi yang tersedia?',
        timestamp: '2025-05-25T08:10:00Z',
        isFromUser: true,
      },
      {
        id: '3-2',
        content: 'Ya, kami memiliki Program Detoksifikasi RSH Satu Bumi yang merupakan program pembersihan tubuh dari racun dan zat berbahaya yang terakumulasi dari makanan, lingkungan, dan stres. Program ini menggunakan metode alami seperti terapi jus, hidroterapi, dan pijat limfatik untuk membantu organ-organ detoksifikasi bekerja optimal.',
        timestamp: '2025-05-25T08:10:30Z',
        isFromUser: false,
      },
      {
        id: '3-3',
        content: 'Berapa lama program detoksifikasi tersebut?',
        timestamp: '2025-05-25T08:12:00Z',
        isFromUser: true,
      },
      {
        id: '3-4',
        content: 'Program detoksifikasi kami tersedia dalam beberapa pilihan durasi: 3 hari, 7 hari, dan 14 hari. Durasi yang paling populer adalah program 7 hari yang memberikan hasil optimal untuk kebanyakan peserta.',
        timestamp: '2025-05-25T08:12:30Z',
        isFromUser: false,
      },
      {
        id: '3-5',
        content: 'Terima kasih atas informasinya!',
        timestamp: '2025-05-25T08:15:00Z',
        isFromUser: true,
      },
    ],
  },
  {
    id: '4',
    sender: '6282345678901@s.whatsapp.net',
    senderName: 'Maria Garcia',
    lastMessage: 'Dimana lokasi RSH Satu Bumi?',
    lastTimestamp: '2025-05-24T15:20:00Z',
    messages: [
      {
        id: '4-1',
        content: 'Dimana lokasi RSH Satu Bumi?',
        timestamp: '2025-05-24T15:20:00Z',
        isFromUser: true,
      },
      {
        id: '4-2',
        content: 'RSH Satu Bumi berlokasi di Jalan Kesehatan No. 123, Jakarta Selatan. Kami buka setiap hari Senin-Sabtu, dari jam 08.00-17.00 WIB.',
        timestamp: '2025-05-24T15:20:30Z',
        isFromUser: false,
      },
    ],
  },
  {
    id: '5',
    sender: '6285678901234@s.whatsapp.net',
    senderName: 'David Kim',
    lastMessage: 'Apakah ada jadwal yoga untuk minggu depan?',
    lastTimestamp: '2025-05-24T11:05:00Z',
    messages: [
      {
        id: '5-1',
        content: 'Apakah ada jadwal yoga untuk minggu depan?',
        timestamp: '2025-05-24T11:05:00Z',
        isFromUser: true,
      },
      {
        id: '5-2',
        content: 'Ya, kami memiliki kelas yoga setiap hari Senin, Rabu, dan Jumat pukul 07.00-08.30 dan 17.00-18.30. Untuk minggu depan, semua kelas masih tersedia dan Anda dapat mendaftar melalui website kami atau menghubungi resepsionis kami.',
        timestamp: '2025-05-24T11:05:45Z',
        isFromUser: false,
      },
    ],
  },
];

// Analytics API functions
export const fetchAnalyticsPerformance = async () => {
  const response = await api.get('/analytics/performance');
  return response.data;
};

export const fetchAnalyticsUsers = async () => {
  try {
    console.log('Fetching user analytics...');
    // Memperbaiki path endpoint sesuai dengan backend
    const response = await api.get('/admin/analytics/users');
    console.log('User analytics response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching user analytics:', error);
    // Tambahkan log detail untuk debugging
    if (axios.isAxiosError(error)) {
      console.error('Axios error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        headers: error.config?.headers,
        responseData: error.response?.data
      });
    }
    throw error;
  }
};

// Function untuk mendapatkan user yang dipilih dari server
export const getSelectedUser = async () => {
  try {
    console.log('Fetching selected user from server...');
    const response = await api.get('/admin/preferences/selected_user');
    console.log('Selected user response:', response.data);
    return response.data.selected_user;
  } catch (error) {
    console.error('Error fetching selected user:', error);
    return null;
  }
};

// Function untuk menyimpan user yang dipilih ke server dengan retry mechanism
export const saveSelectedUser = async (phoneNumber: string, retryCount = 0): Promise<any> => {
  try {
    console.log(`Saving selected user to server: ${phoneNumber}`);
    
    // Pastikan phoneNumber tidak kosong untuk menghindari error
    if (!phoneNumber) {
      console.warn('Attempted to save empty phone number, using fallback');
      localStorage.setItem('selectedUser', '');
      return { success: false, message: 'Empty phone number' };
    }
    
    // Normalisasi nomor telepon jika belum memiliki suffix @s.whatsapp.net
    const normalizedPhoneNumber = phoneNumber.includes('@s.whatsapp.net') 
      ? phoneNumber 
      : `${phoneNumber}@s.whatsapp.net`;
    
    // Gunakan JSON.stringify secara eksplisit untuk memastikan format yang benar
    const payload = JSON.stringify({ selected_user: normalizedPhoneNumber });
    console.log('Sending payload:', payload);
    
    // Log URL yang digunakan
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/admin/preferences/selected-user`;
    console.log(`Sending request to: ${apiUrl}`);
    
    // Gunakan fetch API dengan timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 detik timeout
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: payload,
        credentials: 'include',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Log response details untuk debugging
      console.log(`Response status: ${response.status}`);
      console.log(`Response status text: ${response.statusText}`);
      
      if (!response.ok) {
        // Coba dengan endpoint alternatif jika gagal
        if (response.status === 500 && retryCount === 0) {
          console.warn('Server error, trying alternative endpoint with underscore');
          // Coba endpoint dengan underscore sebagai fallback
          const altApiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/admin/preferences/selected_user`;
          return await saveSelectedUserWithUrl(normalizedPhoneNumber, altApiUrl);
        }
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Save selected user response:', data);
      
      // Simpan juga ke localStorage sebagai fallback
      localStorage.setItem('selectedUser', normalizedPhoneNumber);
      
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: any) {
    // Logging error yang lebih terperinci
    console.error('Error saving selected user:', error);
    
    // Retry logic - maksimal 1 retry
    if (retryCount < 1) {
      console.log(`Retrying saveSelectedUser (attempt ${retryCount + 1})...`);
      return await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
        .then(() => saveSelectedUser(phoneNumber, retryCount + 1));
    }
    
    // Fallback: save to localStorage
    localStorage.setItem('selectedUser', phoneNumber);
    
    // Return objek error yang lebih informatif
    return { 
      success: false, 
      error: error.message || 'Unknown error',
      fallback: true
    };
  }
};

// Helper function untuk mencoba dengan URL alternatif
async function saveSelectedUserWithUrl(phoneNumber: string, apiUrl: string): Promise<any> {
  try {
    console.log(`Trying alternative URL: ${apiUrl}`);
    
    const payload = JSON.stringify({ selected_user: phoneNumber });
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: payload,
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Alternative endpoint failed with ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Save selected user response from alternative endpoint:', data);
    
    // Simpan juga ke localStorage
    localStorage.setItem('selectedUser', phoneNumber);
    
    return data;
  } catch (error: any) {
    console.error('Error with alternative endpoint:', error);
    localStorage.setItem('selectedUser', phoneNumber); // Fallback
    return { success: false, error: error.message, fallback: true };
  }
};

/**
 * Function to delete a thread for a specific phone number
 * @param phoneNumber The phone number to delete the thread for
 * @returns An object with status ('success' or 'error') and optional message
 */
export const deleteThread = async (phoneNumber: string): Promise<{
  status: 'success' | 'error';
  message?: string;
}> => {
  try {
    const response = await api.delete(`/admin/delete-thread/${encodeURIComponent(phoneNumber)}`);
    
    console.log('Thread deletion response:', response.data);
    
    // If the backend returns its own status, use that
    if (response.data && typeof response.data === 'object') {
      if (response.data.status) {
        return response.data;
      }
      
      // For backward compatibility with backend that might return success property
      if (response.data.success === false) {
        return {
          status: 'error',
          message: response.data.error || response.data.message || 'Unknown error'
        };
      }
    }
    
    // Default success response
    return {
      status: 'success',
      message: 'Thread deleted successfully'
    };
  } catch (error: any) {
    console.error('Error deleting thread:', error);
    
    // Handle errors with response
    if (error.response) {
      console.error('Server response:', error.response.data);
      return { 
        status: 'error', 
        message: error.response.data.message || 'Failed to delete thread'
      };
    }
    
    // Handle network errors
    return { 
      status: 'error', 
      message: error.message || 'Network error while deleting thread'
    };
  }
};

// Function to fetch user messages by phone number
export const fetchUserMessages = async (phoneNumber: string): Promise<string[]> => {
  try {
    // Format the phone number to match the API endpoint
    // Remove the @s.whatsapp.net suffix if present
    const formattedPhone = phoneNumber.replace('@s.whatsapp.net', '');
    
    // Call the API to get the user's chat messages
    const response = await api.get(`/admin/user-messages/${formattedPhone}`);
    
    if (response.status === 200 && response.data && response.data.success) {
      // The API returns { success: true, messages: string[] }
      return response.data.messages || [];
    }
    
    // If API call fails, try to get messages from mock data
    const mockChat = mockChats.find(chat => chat.sender === phoneNumber);
    if (mockChat) {
      const userMessages = mockChat.messages
        .filter(message => message.isFromUser)
        .map(message => message.content);
      return userMessages;
    }
    
    return [];
  } catch (error) {
    console.error(`Error fetching messages for user ${phoneNumber}:`, error);
    return [];
  }
};

// Function to fetch thread messages for a specific user with improved error handling and normalization
export const fetchThreadMessages = async (phoneNumber: string, retryCount = 0): Promise<any[]> => {
  try {
    // Log the selected user from localStorage for debugging
    const storedUser = localStorage.getItem('selectedUser');
    console.log(`fetchThreadMessages for: ${phoneNumber}`);
    console.log(`Selected user in localStorage: ${storedUser}`);
    console.log(`Do they match? ${storedUser === phoneNumber}`);
    
    // Normalisasi nomor telepon jika belum memiliki suffix @s.whatsapp.net
    const normalizedPhoneNumber = phoneNumber.includes('@s.whatsapp.net') 
      ? phoneNumber 
      : `${phoneNumber}@s.whatsapp.net`;
    
    console.log(`Using normalized phone number: ${normalizedPhoneNumber}`);
    
    // Coba endpoint utama terlebih dahulu
    try {
      console.log(`Fetching thread messages from /admin/thread-messages/${normalizedPhoneNumber}`);
      const response = await api.get(`/admin/thread-messages/${normalizedPhoneNumber}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        timeout: 8000 // 8 detik timeout
      });
      
      console.log('Thread messages response:', response.data);
      
      // Cache the result in localStorage for offline/error fallback
      if (response.data && response.data.messages) {
        localStorage.setItem(`threadMessages_${normalizedPhoneNumber}`, JSON.stringify(response.data.messages));
        return response.data.messages;
      }
      
      return [];
    } catch (primaryError) {
      console.warn(`Error with primary endpoint: ${primaryError}`);
      
      // Coba endpoint alternatif jika endpoint utama gagal
      console.log(`Trying alternative endpoint: /admin/threads/${normalizedPhoneNumber}/messages`);
      try {
        const altResponse = await api.get(`/admin/threads/${normalizedPhoneNumber}/messages`, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          timeout: 8000
        });
        
        console.log('Thread messages from alternative endpoint:', altResponse.data);
        
        // Cache the result
        if (altResponse.data && altResponse.data.messages) {
          localStorage.setItem(`threadMessages_${normalizedPhoneNumber}`, JSON.stringify(altResponse.data.messages));
          return altResponse.data.messages;
        }
        
        return [];
      } catch (altError) {
        console.error(`Alternative endpoint also failed: ${altError}`);
        throw altError; // Re-throw untuk dihandle oleh catch utama
      }
    }
  } catch (error: any) {
    console.error('Error fetching thread messages:', error);
    
    // Retry logic - maksimal 1 retry jika bukan error 404 (thread not found)
    if (retryCount < 1 && error.response?.status !== 404) {
      console.log(`Retrying fetchThreadMessages (attempt ${retryCount + 1})...`);
      return await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
        .then(() => fetchThreadMessages(phoneNumber, retryCount + 1));
    }
    
    // Coba ambil dari cache jika ada
    const normalizedPhoneNumber = phoneNumber.includes('@s.whatsapp.net') 
      ? phoneNumber 
      : `${phoneNumber}@s.whatsapp.net`;
    
    const cachedMessages = localStorage.getItem(`threadMessages_${normalizedPhoneNumber}`);
    if (cachedMessages) {
      console.log('Using cached thread messages from localStorage');
      return JSON.parse(cachedMessages);
    }
    
    // Return empty array if API fails and no cache
    return [];
  }
};

// Mock statistics for development
const mockStats: ChatStats = {
  totalChatsToday: 15,
  totalChatsThisWeek: 87,
  activeUsers: 42,
  averageResponseTime: 12, // seconds
};
