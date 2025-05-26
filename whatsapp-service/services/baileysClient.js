const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const axios = require('axios');

// Global variables to hold the WhatsApp client connection and status
let waSocket = null;
let connectionState = {
  state: 'disconnected', // 'disconnected', 'connecting', 'connected'
  qrCode: null,
  connectedNumber: null,
  lastUpdated: new Date().toISOString()
};

/**
 * Initialize WhatsApp connection using Baileys
 */
async function initWhatsApp() {
  // Logger configuration
  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  
  // Load or create auth state
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  
  // Create WhatsApp socket connection
  const sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    logger
  });
  
  // Save the socket connection globally
  waSocket = sock;
  
  // Handle connection events
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      // Display QR code in terminal
      qrcode.generate(qr, { small: true });
      console.log('Scan the QR code above to authenticate WhatsApp');
      
      // Convert QR code to base64 image for admin dashboard
      try {
        // Langsung konversi QR code ke base64 secara sinkron
        const base64Data = Buffer.from(qr).toString('base64');
        
        // Store QR code as base64 image for admin dashboard
        connectionState.state = 'connecting';
        connectionState.qrCode = base64Data;
        connectionState.lastUpdated = new Date().toISOString();
        console.log('QR code stored for dashboard');
        
        // Sebagai backup, juga konversi menggunakan qrcode library
        QRCode.toDataURL(qr)
          .then(url => {
            // Extract base64 data from data URL (remove 'data:image/png;base64,' prefix)
            const base64DataFromLib = url.split(',')[1];
            
            // Store QR code as base64 image for admin dashboard
            connectionState.qrCode = base64DataFromLib;
            console.log('QR code converted to base64 image for dashboard using library');
          })
          .catch(err => {
            console.error('Error converting QR code to base64 using library:', err);
            // Sudah ada base64 dari konversi langsung, jadi tidak perlu fallback
          });
      } catch (err) {
        console.error('Error converting QR code to base64 directly:', err);
        // Fallback to library method
        QRCode.toDataURL(qr)
          .then(url => {
            const base64Data = url.split(',')[1];
            connectionState.state = 'connecting';
            connectionState.qrCode = base64Data;
            connectionState.lastUpdated = new Date().toISOString();
            console.log('QR code converted to base64 image using fallback method');
          })
          .catch(secondErr => {
            console.error('Error in fallback QR code conversion:', secondErr);
            // Store raw QR code as last resort
            connectionState.state = 'connecting';
            connectionState.qrCode = qr;
            connectionState.lastUpdated = new Date().toISOString();
          });
      }
    }
    
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('WhatsApp connection closed due to ', lastDisconnect.error);
      
      // Reconnect if not logged out
      if (shouldReconnect) {
        console.log('Reconnecting to WhatsApp...');
        initWhatsApp();
      } else {
        console.log('WhatsApp logged out, please restart the service to reconnect');
      }
    }
    
    if (connection === 'open') {
      console.log('WhatsApp connection established!');
      
      // Update connection state
      connectionState.state = 'connected';
      connectionState.qrCode = null;
      connectionState.lastUpdated = new Date().toISOString();
      
      // Get the connected number
      try {
        const { user } = sock.authState.creds;
        connectionState.connectedNumber = user.id;
        console.log(`Connected as: ${user.id}`);
      } catch (error) {
        console.error('Error getting connected number:', error);
      }
    }
  });
  
  // Save credentials on update
  sock.ev.on('creds.update', saveCreds);
  
  // Handle incoming messages
  sock.ev.on('messages.upsert', async ({ messages }) => {
    if (messages && Array.isArray(messages) && messages.length > 0) {
      try {
        // Forward messages to the incoming webhook endpoint
        await axios.post('http://localhost:3200/incoming', { messages });
        console.log('Forwarded incoming messages to webhook handler');
      } catch (error) {
        console.error('Error forwarding messages to webhook:', error.message);
      }
    }
  });
  
  return sock;
}

/**
 * Send a message to a specific WhatsApp user
 * @param {string} to - Recipient's phone number with country code (e.g., 6281234567890)
 * @param {string} text - Message text to send
 * @returns {Promise} - Promise resolving to message info
 */
async function sendWhatsAppMessage(to, text) {
  if (!waSocket) {
    throw new Error('WhatsApp client not initialized');
  }
  
  // Format the number to ensure it has @s.whatsapp.net
  const formattedNumber = to.includes('@s.whatsapp.net') 
    ? to 
    : `${to.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
  
  try {
    const result = await waSocket.sendMessage(formattedNumber, { text });
    return result;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw error;
  }
}

/**
 * Get the WhatsApp client instance
 * @returns {Object} - The WhatsApp client
 */
function getWhatsAppClient() {
  if (!waSocket) {
    throw new Error('WhatsApp client not initialized');
  }
  return waSocket;
}

/**
 * Get the current connection status
 * @returns {Object} - Connection status object
 */
function getConnectionStatus() {
  return connectionState;
}

/**
 * Get the QR code for WhatsApp authentication
 * @returns {string|null} - QR code string or null if not available
 */
function getQRCode() {
  return connectionState.qrCode;
}

/**
 * Force refresh the QR code for WhatsApp authentication
 * @returns {Promise<boolean>} - Promise resolving to true if successful
 */
async function refreshQRCode() {
  try {
    // Only attempt to refresh if we're not already connected
    if (connectionState.state === 'connected') {
      console.log('Cannot refresh QR code: WhatsApp is already connected');
      return false;
    }
    
    console.log('Starting QR code refresh process...');
    
    // Reset the connection state
    connectionState.state = 'disconnected';
    connectionState.qrCode = null;
    connectionState.lastUpdated = new Date().toISOString();
    
    // If there's an existing connection, log out
    if (waSocket) {
      try {
        await waSocket.logout();
        console.log('Logged out existing WhatsApp connection');
      } catch (logoutError) {
        console.warn('Error logging out:', logoutError);
        // Continue anyway
      }
      
      // Set waSocket to null to ensure a completely fresh connection
      waSocket = null;
    }
    
    // Delete auth files to force new QR code generation
    try {
      const fs = require('fs');
      const path = require('path');
      const authDir = path.join(process.cwd(), 'auth_info_baileys');
      
      if (fs.existsSync(authDir)) {
        console.log('Removing existing auth files to force new QR code...');
        const files = fs.readdirSync(authDir);
        for (const file of files) {
          fs.unlinkSync(path.join(authDir, file));
        }
      }
    } catch (fsError) {
      console.warn('Error cleaning auth files:', fsError);
      // Continue anyway
    }
    
    // Reinitialize WhatsApp connection
    console.log('Reinitializing WhatsApp connection to generate new QR code...');
    await initWhatsApp();
    
    // Wait for QR code to be generated (max 15 seconds)
    let attempts = 0;
    while (!connectionState.qrCode && attempts < 15) {
      console.log(`Waiting for QR code generation... Attempt ${attempts + 1}/15`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    if (connectionState.qrCode) {
      console.log('New QR code generated successfully');
      
      // If the QR code is not already a base64 image, convert it
      if (typeof connectionState.qrCode === 'string' && !connectionState.qrCode.includes(',')) {
        try {
          const qrDataUrl = await QRCode.toDataURL(connectionState.qrCode);
          const base64Data = qrDataUrl.split(',')[1];
          connectionState.qrCode = base64Data;
          console.log('QR code converted to base64 image format');
        } catch (qrError) {
          console.warn('Error converting refreshed QR code to base64:', qrError);
          // Keep the original QR code as fallback
        }
      }
      
      return true;
    } else {
      console.error('Failed to generate new QR code after multiple attempts');
      return false;
    }
  } catch (error) {
    console.error('Error refreshing QR code:', error);
    throw error;
  }
}

/**
 * Logout dari WhatsApp
 * @returns {Promise<boolean>} - Promise resolving to true if logout successful
 */
async function logoutWhatsApp() {
  try {
    if (!waSocket) {
      console.log('No active WhatsApp connection to logout from');
      return false;
    }

    console.log('Logging out from WhatsApp...');
    await waSocket.logout();
    
    // Reset connection state
    connectionState.state = 'disconnected';
    connectionState.qrCode = null;
    connectionState.connectedNumber = null;
    connectionState.lastUpdated = new Date().toISOString();
    
    // Set waSocket to null
    waSocket = null;
    
    console.log('Successfully logged out from WhatsApp');
    return true;
  } catch (error) {
    console.error('Error logging out from WhatsApp:', error);
    return false;
  }
}

module.exports = {
  initWhatsApp,
  sendWhatsAppMessage,
  getWhatsAppClient,
  getConnectionStatus,
  getQRCode,
  refreshQRCode,
  logoutWhatsApp
};
