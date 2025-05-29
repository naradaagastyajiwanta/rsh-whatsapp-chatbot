const axios = require('axios');
const { sendWhatsAppMessage, getWhatsAppClient } = require('../services/baileysClient');

// Flask backend URL
const FLASK_BACKEND_URL = process.env.FLASK_BACKEND_URL || 'http://localhost:5000/ask';

// Cache untuk mencegah pengiriman pesan duplikat
const messageCache = new Map();
const CACHE_TTL = 60 * 1000; // 60 detik

/**
 * Membersihkan cache secara periodik
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of messageCache.entries()) {
    if (now - data.timestamp > CACHE_TTL) {
      messageCache.delete(key);
    }
  }
}, CACHE_TTL);

/**
 * Handle incoming WhatsApp messages and forward to Flask backend
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handleIncomingMessage(req, res) {
  try {
    // Extract message data from Baileys webhook
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No valid messages in the request' 
      });
    }
    
    // Process each message
    for (const message of messages) {
      // Skip if not a text message or if it's from the bot itself
      if (!message.message?.conversation && !message.message?.extendedTextMessage) continue;
      if (message.key.fromMe) continue;
      
      const sender = message.key.remoteJid;
      const text = message.message.conversation || message.message.extendedTextMessage.text;
      const senderName = message.pushName || 'User';
      const messageId = message.key.id || `${sender}_${Date.now()}`;
      
      // Cek apakah pesan ini sudah diproses sebelumnya
      if (messageCache.has(messageId)) {
        console.log(`Skipping duplicate message with ID: ${messageId}`);
        continue;
      }
      
      // Tambahkan pesan ke cache
      messageCache.set(messageId, {
        timestamp: Date.now(),
        processed: false
      });
      
      console.log(`Received message from ${senderName} (${sender}): ${text}`);
      console.log(`Message ID: ${messageId}`);
      
      // Forward to Flask backend with unique request ID
      try {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        console.log(`Sending request to Flask backend with ID: ${requestId}`);
        
        const response = await axios.post(FLASK_BACKEND_URL, {
          sender: sender,
          message: text,
          sender_name: senderName,
          request_id: requestId,
          timestamp: Date.now()
        }, {
          headers: {
            'Cache-Control': 'no-cache',
            'X-Request-ID': requestId
          },
          timeout: 60000 // 60 second timeout
        });
        
        // Verifikasi respons
        if (response.data && response.data.response) {
          // Tandai pesan sebagai sudah diproses
          if (messageCache.has(messageId)) {
            messageCache.set(messageId, {
              timestamp: Date.now(),
              processed: true
            });
          }
          
          // Kirim respons ke pengguna WhatsApp
          console.log(`Received response for request ${requestId}:`, response.data.response.substring(0, 100) + '...');
          await sendWhatsAppMessage(sender, response.data.response);
          console.log(`Sent response to ${senderName} for message ID: ${messageId}`);
        } else {
          console.error(`Invalid response format for request ${requestId}:`, response.data);
          await sendWhatsAppMessage(
            sender, 
            "Maaf, terjadi kesalahan saat memproses pesan Anda. Format respons tidak valid."
          );
        }
      } catch (error) {
        console.error(`Error forwarding message to Flask backend (ID: ${messageId}):`, error.message);
        if (error.response) {
          console.error('Response data:', error.response.data);
          console.error('Response status:', error.response.status);
        }
        
        // Send error message to user
        await sendWhatsAppMessage(
          sender, 
          "Maaf, terjadi kesalahan saat memproses pesan Anda. Silakan coba lagi nanti."
        );
      }
    }
    
    // Respond to the webhook
    res.status(200).json({ success: true, message: 'Messages processed' });
  } catch (error) {
    console.error('Error processing incoming message:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Send a message to a WhatsApp user (used by Flask backend)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function sendMessage(req, res) {
  try {
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: to and message'
      });
    }
    
    // Send message to WhatsApp user
    await sendWhatsAppMessage(to, message);
    
    res.status(200).json({
      success: true,
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

module.exports = {
  handleIncomingMessage,
  sendMessage
};
