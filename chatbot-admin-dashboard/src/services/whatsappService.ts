import axios from 'axios';

// WhatsApp service URL
const WHATSAPP_SERVICE_URL = process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_URL || 'http://localhost:3200';

// Flag to track if we've already shown the connection error
let hasShownConnectionError = false;

export interface WhatsAppServiceStatus {
  status: 'connected' | 'disconnected' | 'connecting';
  timestamp: string;
  qrCode?: string;
  connectedNumber?: string;
  error?: string;
}

export interface WhatsAppMessage {
  to: string;
  message: string;
}

/**
 * Get the current status of the WhatsApp service
 */
export const getWhatsAppStatus = async (): Promise<WhatsAppServiceStatus> => {
  try {
    // Try the /health endpoint first
    try {
      const response = await axios.get(`${WHATSAPP_SERVICE_URL}/health`, { timeout: 5000 });
      hasShownConnectionError = false; // Reset the flag if successful
      return response.data;
    } catch (healthError) {
      // If /health fails, try /status as fallback
      const response = await axios.get(`${WHATSAPP_SERVICE_URL}/status`, { timeout: 5000 });
      hasShownConnectionError = false; // Reset the flag if successful
      return response.data;
    }
  } catch (error) {
    // Only log the error once to avoid console spam
    if (!hasShownConnectionError) {
      console.error('Error fetching WhatsApp service status:', error);
      hasShownConnectionError = true;
    }
    
    // Return a fallback status object when the service is unavailable
    return {
      status: 'disconnected',
      timestamp: new Date().toISOString(),
      error: 'WhatsApp service is not available. Please check if the service is running.'
    };
  }
};

/**
 * Send a message via WhatsApp service
 */
export const sendWhatsAppMessage = async (to: string, message: string): Promise<any> => {
  try {
    // Try the standard /send endpoint
    try {
      const response = await axios.post(`${WHATSAPP_SERVICE_URL}/send`, {
        to,
        message
      }, { timeout: 8000 });
      return response.data;
    } catch (sendError) {
      // Try alternative endpoint if the first one fails
      const response = await axios.post(`${WHATSAPP_SERVICE_URL}/api/send`, {
        to,
        message
      }, { timeout: 8000 });
      return response.data;
    }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw new Error('Failed to send message. WhatsApp service may be unavailable.');
  }
};

/**
 * Get QR code for WhatsApp authentication
 */
export const getWhatsAppQRCode = async (): Promise<string | null> => {
  try {
    // Try multiple possible endpoints for QR code
    try {
      const response = await axios.get(`${WHATSAPP_SERVICE_URL}/qrcode`, { timeout: 5000 });
      return response.data.qrCode;
    } catch (qrError) {
      // Try alternative endpoint
      const statusResponse = await axios.get(`${WHATSAPP_SERVICE_URL}/status`, { timeout: 5000 });
      return statusResponse.data.qrCode || null;
    }
  } catch (error) {
    console.error('Error fetching WhatsApp QR code:', error);
    return null;
  }
};

/**
 * Refresh the QR code for WhatsApp authentication
 * @returns Promise resolving to success status and new QR code if available
 */
export const refreshWhatsAppQRCode = async (): Promise<{ success: boolean; message: string; qrCode?: string }> => {
  try {
    const response = await axios.post(`${WHATSAPP_SERVICE_URL}/refresh-qrcode`);
    return response.data;
  } catch (error) {
    console.error('Error refreshing WhatsApp QR code:', error);
    return {
      success: false,
      message: 'Failed to refresh QR code. WhatsApp service might be unavailable.'
    };
  }
};

/**
 * Logout from WhatsApp
 * @returns Promise resolving to success status and message
 */
export const logoutFromWhatsApp = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await axios.post(`${WHATSAPP_SERVICE_URL}/logout`);
    return response.data;
  } catch (error) {
    console.error('Error logging out from WhatsApp:', error);
    return {
      success: false,
      message: 'Failed to logout from WhatsApp. WhatsApp service might be unavailable.'
    };
  }
};
