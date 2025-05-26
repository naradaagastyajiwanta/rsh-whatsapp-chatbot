require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const { initWhatsApp } = require('./services/baileysClient');
const messageController = require('./controllers/messageController');
const statusController = require('./controllers/statusController');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3200; // Use 3200 as default to avoid conflict with Next.js

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Enable CORS with specific configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'], // Allow requests from admin dashboard
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add headers for older browsers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Initialize WhatsApp connection
initWhatsApp().catch(err => {
  console.error('Error initializing WhatsApp:', err);
  process.exit(1);
});

// Routes
app.post('/incoming', messageController.handleIncomingMessage);
app.post('/send', messageController.sendMessage);

// Status endpoints for admin dashboard
app.get('/health', statusController.getStatus);
app.get('/qrcode', statusController.getQRCodeData);
app.post('/refresh-qrcode', statusController.refreshWhatsAppQRCode);
app.post('/logout', statusController.logoutFromWhatsApp);

// Start the server
app.listen(PORT, () => {
  console.log(`WhatsApp API Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
