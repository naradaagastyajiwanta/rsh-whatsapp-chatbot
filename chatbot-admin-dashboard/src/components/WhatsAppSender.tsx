import React, { useState } from 'react';
import { sendWhatsAppMessage } from '@/services/whatsappService';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';

export default function WhatsAppSender() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber || !message) {
      setStatus({
        type: 'error',
        message: 'Please enter both phone number and message'
      });
      return;
    }
    
    // Format phone number (remove spaces, add country code if needed)
    let formattedNumber = phoneNumber.replace(/\s+/g, '');
    if (!formattedNumber.includes('@s.whatsapp.net')) {
      // If it doesn't have the WhatsApp suffix, add it
      formattedNumber = `${formattedNumber}@s.whatsapp.net`;
    }
    
    try {
      setSending(true);
      setStatus(null);
      
      await sendWhatsAppMessage(formattedNumber, message);
      
      setStatus({
        type: 'success',
        message: 'Message sent successfully!'
      });
      
      // Clear message field but keep phone number for convenience
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      setStatus({
        type: 'error',
        message: 'Failed to send message. Please check the WhatsApp service status.'
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6 transition-all duration-300 hover:shadow-xl overflow-hidden">
      <div className="flex justify-between items-center mb-4 pb-3 relative">
        <h2 className="text-xl font-bold flex items-center text-gray-800 group">
          <div className="bg-green-500 p-2 rounded-full mr-3 shadow-md transition-all duration-300 group-hover:scale-110 group-hover:rotate-12">
            <PaperAirplaneIcon className="h-5 w-5 text-white" />
          </div>
          Send WhatsApp Message
        </h2>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Phone Number
          </label>
          <div className="relative">
            <input
              type="text"
              id="phoneNumber"
              className="w-full px-3 py-3 pl-10 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
              placeholder="e.g., 628123456789"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={sending}
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-400">+</span>
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-500 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Enter number with country code (e.g., 62 for Indonesia)
          </p>
        </div>
        
        <div className="mb-4">
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Message
          </label>
          <div className="relative">
            <textarea
              id="message"
              rows={4}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
              placeholder="Type your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sending}
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-400">
              {message.length} characters
            </div>
          </div>
        </div>
        
        {status && (
          <div className={`p-4 mb-4 rounded-lg border ${status.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'} transition-all duration-300 animate-fadeIn`}>
            <div className="flex items-center">
              {status.type === 'success' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span className="font-medium">{status.message}</span>
            </div>
          </div>
        )}
        
        <button
          type="submit"
          className={`w-full flex justify-center items-center py-3 px-6 border border-transparent rounded-lg shadow-md text-sm font-medium text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 transform hover:-translate-y-1 ${sending ? 'opacity-75 cursor-not-allowed' : ''}`}
          disabled={sending}
        >
          {sending ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending...
            </>
          ) : (
            <>
              <PaperAirplaneIcon className="h-4 w-4 mr-2" />
              Send Message
            </>
          )}
        </button>
      </form>
    </div>
  );
}
