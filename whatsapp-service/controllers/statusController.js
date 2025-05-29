const { getWhatsAppClient, getConnectionStatus, getQRCode, refreshQRCode, logoutWhatsApp } = require('../services/baileysClient');
const axios = require('axios');

// URL backend untuk update status via WebSocket
const BACKEND_STATUS_URL = 'http://localhost:5000/whatsapp/status/update';

// Interval untuk mengirim status ke backend (dalam ms)
const STATUS_UPDATE_INTERVAL = 3000; // 3 detik

// Simpan interval ID untuk bisa dihentikan jika diperlukan
let statusUpdateInterval = null;

/**
 * Get the current status of the WhatsApp connection
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getStatus(req, res) {
  try {
    const status = getConnectionStatus();
    
    res.status(200).json({
      status: status.state,
      timestamp: new Date().toISOString(),
      qrCode: status.qrCode,
      connectedNumber: status.connectedNumber
    });
  } catch (error) {
    console.error('Error getting WhatsApp status:', error);
    res.status(500).json({
      status: 'disconnected',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
}

/**
 * Get the QR code for WhatsApp authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getQRCodeData(req, res) {
  try {
    const qrCode = getQRCode();
    
    if (!qrCode) {
      return res.status(404).json({
        success: false,
        message: 'QR code not available. WhatsApp might already be connected or not initialized yet.'
      });
    }
    
    res.status(200).json({
      success: true,
      qrCode
    });
  } catch (error) {
    console.error('Error getting QR code:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Refresh the QR code for WhatsApp authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function refreshWhatsAppQRCode(req, res) {
  try {
    console.log('Refresh QR code request received');
    const success = await refreshQRCode();
    
    if (success) {
      console.log('QR code refreshed successfully');
      // Tunggu sebentar untuk memastikan QR code sudah di-generate
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Ambil status terbaru termasuk QR code baru
      const status = getConnectionStatus();
      
      res.status(200).json({
        success: true,
        message: 'QR code refreshed successfully',
        timestamp: new Date().toISOString(),
        status: status.state,
        note: 'QR code telah di-refresh. Silakan lihat di terminal untuk memindai QR code.'
      });
    } else {
      console.log('Failed to refresh QR code');
      res.status(400).json({
        success: false,
        message: 'Failed to refresh QR code',
        timestamp: new Date().toISOString(),
        note: 'Gagal me-refresh QR code. Coba restart WhatsApp service.'
      });
    }
  } catch (error) {
    console.error('Error refreshing QR code:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while refreshing QR code',
      error: error.message,
      timestamp: new Date().toISOString(),
      note: 'Terjadi kesalahan saat me-refresh QR code. Coba restart WhatsApp service.'
    });
  }
}

/**
 * Logout dari WhatsApp
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function logoutFromWhatsApp(req, res) {
  try {
    console.log('Logout request received');
    const success = await logoutWhatsApp();
    
    if (success) {
      console.log('Logout successful');
      res.status(200).json({
        success: true,
        message: 'Successfully logged out from WhatsApp',
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('Logout failed - No active connection');
      res.status(400).json({
        success: false,
        message: 'No active WhatsApp connection to logout from',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during logout',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Mengirim status WhatsApp ke backend untuk diteruskan via WebSocket
 */
async function sendStatusToBackend() {
  try {
    const status = getConnectionStatus();
    
    // Format status untuk dikirim ke backend
    const statusData = {
      status: status.state,
      timestamp: new Date().toISOString(),
      qrCode: status.qrCode,
      connectedNumber: status.connectedNumber
    };
    
    // Kirim status ke backend
    const response = await axios.post(BACKEND_STATUS_URL, statusData, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('Status sent to backend successfully:', response.data);
    return true;
  } catch (error) {
    console.error('Error sending status to backend:', error.message);
    return false;
  }
}

/**
 * Memulai interval untuk mengirim status ke backend secara berkala
 */
function startStatusUpdateInterval() {
  // Hentikan interval yang sudah ada jika ada
  if (statusUpdateInterval) {
    clearInterval(statusUpdateInterval);
  }
  
  // Kirim status pertama kali
  sendStatusToBackend();
  
  // Set interval untuk mengirim status secara berkala
  statusUpdateInterval = setInterval(sendStatusToBackend, STATUS_UPDATE_INTERVAL);
  console.log(`Started status update interval (every ${STATUS_UPDATE_INTERVAL/1000} seconds)`);
}

// Mulai interval saat modul di-load
startStatusUpdateInterval();

module.exports = {
  getStatus,
  getQRCodeData,
  refreshWhatsAppQRCode,
  logoutFromWhatsApp,
  sendStatusToBackend,
  startStatusUpdateInterval
};
