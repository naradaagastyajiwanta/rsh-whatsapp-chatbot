const axios = require('axios');
const { sendWhatsAppMessage, getWhatsAppClient } = require('../services/baileysClient');

// Flask backend URL
const FLASK_BACKEND_URL = process.env.FLASK_BACKEND_URL || 'http://localhost:5000/ask';

// Cache untuk mencegah pengiriman pesan duplikat
const messageCache = new Map();
const responseCache = new Map(); // Cache untuk mencegah pengiriman respons duplikat
const CACHE_TTL = 120 * 1000; // 120 detik (2 menit)
const RESPONSE_CACHE_TTL = 60 * 1000; // 60 detik (1 menit)

/**
 * Membersihkan cache secara periodik
 */
setInterval(() => {
  const now = Date.now();
  // Clean message cache
  for (const [key, data] of messageCache.entries()) {
    if (now - data.timestamp > CACHE_TTL) {
      messageCache.delete(key);
    }
  }
  
  // Clean response cache
  for (const [key, data] of responseCache.entries()) {
    if (now - data.timestamp > RESPONSE_CACHE_TTL) {
      responseCache.delete(key);
    }
  }
  
  console.log(`Cache stats - Messages: ${messageCache.size}, Responses: ${responseCache.size}`);
}, 30 * 1000); // Run cleanup every 30 seconds

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
      
      // Generate a more robust message fingerprint that includes content
      const messageFingerprint = `${messageId}_${sender}_${text.substring(0, 20)}`;
      
      // Cek apakah pesan ini sudah diproses sebelumnya
      if (messageCache.has(messageId) || messageCache.has(messageFingerprint)) {
        console.log(`Skipping duplicate message with ID: ${messageId} / Fingerprint: ${messageFingerprint}`);
        continue;
      }
      
      // Tambahkan pesan ke cache dengan dua kunci untuk redundansi
      const cacheData = {
        timestamp: Date.now(),
        processed: false,
        text: text.substring(0, 50), // Store partial text for debugging
        sender: sender
      };
      
      messageCache.set(messageId, cacheData);
      messageCache.set(messageFingerprint, cacheData);
      
      console.log(`Received message from ${senderName} (${sender}): ${text}`);
      console.log(`Message ID: ${messageId}`);
      
      // Forward to Flask backend with unique request ID
      try {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        console.log(`Sending request to Flask backend with ID: ${requestId}`);
        
        // Check if we've recently sent a very similar request
        const recentRequestKey = `${sender}_${text.substring(0, 30)}`;
        if (responseCache.has(recentRequestKey)) {
          const recentRequest = responseCache.get(recentRequestKey);
          const timeSinceLastRequest = Date.now() - recentRequest.timestamp;
          
          if (timeSinceLastRequest < 5000) { // 5 seconds
            console.log(`Blocking potential duplicate request to Flask. Similar request sent ${timeSinceLastRequest}ms ago`);
            continue;
          }
        }
        
        // Add to response cache before sending to prevent parallel duplicates
        responseCache.set(recentRequestKey, {
          timestamp: Date.now(),
          requestId: requestId
        });
        
        const response = await axios.post(FLASK_BACKEND_URL, {
          sender: sender,
          message: text,
          sender_name: senderName,
          request_id: requestId,
          timestamp: Date.now()
        }, {
          headers: {
            'Cache-Control': 'no-cache',
            'X-Request-ID': requestId,
            'X-Idempotency-Key': messageId // Add idempotency key for backend deduplication
          },
          timeout: 60000 // 60 second timeout
        });
        
        // Verifikasi respons
        if (response.data && response.data.hasOwnProperty('response')) {
          // Tandai pesan sebagai sudah diproses
          const messageFingerprint = `${messageId}_${sender}_${text.substring(0, 20)}`;
          
          // Update message cache to mark as processed
          if (messageCache.has(messageId)) {
            messageCache.set(messageId, {
              timestamp: Date.now(),
              processed: true,
              text: text.substring(0, 50),
              sender: sender,
              responseId: requestId
            });
          }
          
          if (messageCache.has(messageFingerprint)) {
            messageCache.set(messageFingerprint, {
              timestamp: Date.now(),
              processed: true,
              text: text.substring(0, 50),
              sender: sender,
              responseId: requestId
            });
          }
          
          // Cek apakah bot dimatikan untuk pengguna ini
          if (response.data.bot_disabled === true) {
            console.log(`Bot disabled for ${sender}. No response will be sent.`);
            continue; // Skip sending any message
          }
          
          // Cek apakah respons kosong (string kosong)
          if (response.data.response === "") {
            console.log(`Empty response received for ${sender}. No message will be sent.`);
            continue; // Skip sending any message
          }
          
          // Hanya lanjutkan jika respons tidak kosong
          if (response.data.response && response.data.response.length > 0) {
            const responseFingerprint = `${sender}_${response.data.response.substring(0, 30)}`;
            
            // Check if we've already sent this exact response recently
            if (responseCache.has(responseFingerprint)) {
              const recentResponse = responseCache.get(responseFingerprint);
              const timeSinceLastResponse = Date.now() - recentResponse.timestamp;
              
              if (timeSinceLastResponse < 10000) { // 10 seconds
                console.log(`Blocking duplicate response to ${sender}. Similar response sent ${timeSinceLastResponse}ms ago`);
                continue;
              }
            }
            
            // Add response to cache
            responseCache.set(responseFingerprint, {
              timestamp: Date.now(),
              requestId: requestId,
              messageId: messageId
            });
            
            // Kirim respons ke pengguna WhatsApp
            console.log(`Received response for request ${requestId}:`, response.data.response.substring(0, 100) + '...');
            await sendWhatsAppMessage(sender, response.data.response);
            console.log(`Sent response to ${senderName} for message ID: ${messageId}`);
          }
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
