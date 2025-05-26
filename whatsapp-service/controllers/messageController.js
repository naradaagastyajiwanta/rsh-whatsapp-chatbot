const axios = require('axios');
const { sendWhatsAppMessage, getWhatsAppClient } = require('../services/baileysClient');

// Flask backend URL
const FLASK_BACKEND_URL = process.env.FLASK_BACKEND_URL || 'http://localhost:5000/ask';

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
      
      console.log(`Received message from ${senderName} (${sender}): ${text}`);
      
      // Forward to Flask backend
      try {
        const response = await axios.post(FLASK_BACKEND_URL, {
          sender: sender,
          message: text,
          sender_name: senderName
        });
        
        // Send response back to WhatsApp user
        if (response.data && response.data.response) {
          await sendWhatsAppMessage(sender, response.data.response);
          console.log(`Sent response to ${senderName}: ${response.data.response}`);
        }
      } catch (error) {
        console.error('Error forwarding message to Flask backend:', error.message);
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
