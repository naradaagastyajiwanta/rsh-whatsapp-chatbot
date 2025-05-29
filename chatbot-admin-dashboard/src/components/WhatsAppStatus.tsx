import React, { useState, useEffect } from 'react';
import { getWhatsAppStatus, refreshWhatsAppQRCode, logoutFromWhatsApp, WhatsAppServiceStatus } from '@/services/whatsappService';
import { PhoneIcon, QrCodeIcon, ExclamationCircleIcon, CheckCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import websocketService from '@/services/websocket';
import { useLanguage } from '@/context/LanguageContext';

export default function WhatsAppStatus() {
  const { t } = useLanguage();
  const [status, setStatus] = useState<WhatsAppServiceStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [logoutSuccess, setLogoutSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoading(true);
        const data = await getWhatsAppStatus();
        setStatus(data);
        
        // If the status has an error property, set it as the error
        if (data.error) {
          setError(data.error);
        } else {
          setError(null);
        }
      } catch (err) {
        setError(t('whatsapp.errorConnect'));
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchStatus();
    
    // Subscribe to WebSocket updates for WhatsApp status
    const handleWhatsAppStatusUpdate = (data: WhatsAppServiceStatus) => {
      console.log('Received WhatsApp status update via WebSocket:', data);
      setStatus(data);
      setLoading(false);
      
      if (data.error) {
        setError(data.error);
      } else {
        setError(null);
      }
    };
    
    // Subscribe to whatsapp_status events
    websocketService.subscribeToWhatsAppStatus(handleWhatsAppStatusUpdate);
    
    // Clean up subscription when component unmounts
    return () => {
      websocketService.unsubscribeFromWhatsAppStatus(handleWhatsAppStatusUpdate);
    };
  }, []);

  const handleRefreshQRCode = async () => {
    try {
      setIsRefreshing(true);
      setRefreshError(null);
      await refreshWhatsAppQRCode();
    } catch (error) {
      setRefreshError(t('whatsapp.errorRefreshQR'));
      console.error('Error refreshing QR code:', error);
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      setLogoutError(null);
      setLogoutSuccess(null);
      await logoutFromWhatsApp();
      setLogoutSuccess(t('whatsapp.logoutSuccess'));
    } catch (error) {
      setLogoutError(t('whatsapp.errorLogout'));
      console.error('Error logging out from WhatsApp:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const renderStatusBadge = () => {
    switch (status?.status) {
      case 'connected':
        return (
          <div className="flex items-center bg-green-100 text-green-700 px-3 py-1 rounded-full shadow-sm">
            <CheckCircleIcon className="h-5 w-5 mr-2" />
            <span className="font-medium">{t('whatsapp.connected')}</span>
          </div>
        );
      case 'connecting':
        return (
          <div className="flex items-center bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full shadow-sm">
            <QrCodeIcon className="h-5 w-5 mr-2" />
            <span className="font-medium">{t('whatsapp.waitingForScan')}</span>
          </div>
        );
      case 'disconnected':
        return (
          <div className="flex items-center bg-red-100 text-red-700 px-3 py-1 rounded-full shadow-sm">
            <ExclamationCircleIcon className="h-5 w-5 mr-2" />
            <span className="font-medium">{t('whatsapp.disconnected')}</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-100 p-6 mb-6 transition-all duration-300 hover:shadow-xl overflow-hidden">
      {/* Header dengan gradien */}
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100 relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-green-400"></div>
        <h2 className="text-xl font-bold flex items-center text-gray-800 group">
          <div className="bg-blue-500 p-2 rounded-full mr-3 shadow-md transition-all duration-300 group-hover:scale-110 group-hover:rotate-12">
            <PhoneIcon className="h-5 w-5 text-white" />
          </div>
          {t('whatsapp.title')}
        </h2>
        
        {/* Tombol Logout WhatsApp dengan desain yang lebih baik */}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut || loading}
          className={`px-4 py-2 rounded-md flex items-center shadow-sm transition-all duration-200 ${isLoggingOut || loading ? 'bg-gray-300 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 hover:shadow-md active:bg-red-700 text-white transform hover:-translate-y-1'}`}
        >
          {isLoggingOut ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{t('whatsapp.loggingOut')}</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>{t('whatsapp.logout')}</span>
            </>
          )}
        </button>
      </div>
      
      {/* Notifikasi dengan animasi */}
      {logoutError && (
        <div className="text-sm text-red-500 mb-4 p-2 bg-red-50 rounded-md border-l-4 border-red-500">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {logoutError}
          </div>
        </div>
      )}
      
      {logoutSuccess && (
        <div className="text-sm text-green-600 mb-4 p-2 bg-green-50 rounded-md border-l-4 border-green-500">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {logoutSuccess}
          </div>
        </div>
      )}
      
      {loading ? (
        <div className="flex flex-col items-center justify-center py-8 bg-gradient-to-b from-white to-blue-50 rounded-lg">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-500 text-sm">{t('whatsapp.connecting')}</p>
          <div className="animate-pulse flex space-x-4 mt-4 w-full max-w-md">
            <div className="flex-1 space-y-3 py-1">
              <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-5 shadow-sm transition-all duration-300 hover:shadow-md">
          <div className="flex items-center mb-3">
            <div className="bg-red-100 p-2 rounded-full mr-3">
              <ExclamationCircleIcon className="h-6 w-6 text-red-500" />
            </div>
            <span className="font-bold text-red-700 text-lg">{t('whatsapp.serviceError')}</span>
          </div>
          <p className="text-sm text-red-600 mb-3 p-2 bg-red-100 rounded-md">{error}</p>
          <div className="text-sm text-gray-700 bg-white p-3 rounded-md border border-gray-100">
            <p className="mb-2 font-medium">{t('whatsapp.possibleSolutions')}:</p>
            <ul className="list-none space-y-2">
              <li className="flex items-start">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{t('whatsapp.checkServiceRunning')} <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">{process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_URL || 'http://localhost:3200'}</span></span>
              </li>
              <li className="flex items-start">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{t('whatsapp.verifyEnvFile')} <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">.env</span> {t('whatsapp.hasCorrect')} <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">NEXT_PUBLIC_WHATSAPP_SERVICE_URL</span></span>
              </li>
              <li className="flex items-start">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{t('whatsapp.ensureCors')}</span>
              </li>
            </ul>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-3 w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t('whatsapp.refreshPage')}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          {/* Status Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-4 shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-md hover:bg-blue-50 hover:border-blue-200">
              <h3 className="text-sm font-medium text-gray-500 mb-2">{t('whatsapp.status')}</h3>
              <div className="flex items-center">
                {renderStatusBadge()}
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-md hover:bg-blue-50 hover:border-blue-200">
              <h3 className="text-sm font-medium text-gray-500 mb-2">{t('whatsapp.lastUpdated')}</h3>
              <div className="text-gray-700 font-medium flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {new Date(status?.timestamp || '').toLocaleString()}
              </div>
            </div>
          </div>
          
          {/* Connected Number Card - only shown when connected */}
          {status?.connectedNumber && (
            <div className="bg-green-50 rounded-lg p-4 shadow-sm border border-green-100 mb-4 transition-all duration-300 hover:shadow-md transform hover:-translate-y-1">
              <h3 className="text-sm font-medium text-green-700 mb-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {t('whatsapp.phoneNumber')}
              </h3>
              <div className="text-gray-700 font-medium bg-white p-2 rounded-md border border-green-100">
                {status.connectedNumber}
              </div>
            </div>
          )}
          
          {(status?.status === 'connecting' || status?.status === 'disconnected') && (
            <div className="mt-6 bg-gradient-to-br from-white to-blue-50 rounded-lg p-5 border border-gray-200 shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-center mb-4">
                <div className="flex items-center mb-3 md:mb-0">
                  <div className="bg-blue-100 p-2 rounded-full mr-3">
                    <QrCodeIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-800">
                    {status?.status === 'disconnected' ? t('whatsapp.disconnected') : t('whatsapp.connectToWhatsApp')}
                  </h3>
                </div>
                
                <button
                  onClick={handleRefreshQRCode}
                  disabled={isRefreshing}
                  className={`px-4 py-2 rounded-md flex items-center shadow-sm ${isRefreshing ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white transition-all duration-200 hover:shadow-md transform hover:-translate-y-1'}`}
                >
                  {isRefreshing ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>{t('whatsapp.refreshing')}</span>
                    </>
                  ) : (
                    <>
                      <ArrowPathIcon className="h-4 w-4 mr-2" />
                      <span>{t('whatsapp.refreshQR')}</span>
                    </>
                  )}
                </button>
              </div>
              
              {refreshError && (
                <div className="text-sm text-red-500 p-2 bg-red-50 rounded-md mb-4 border-l-4 border-red-500">
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {refreshError}
                  </div>
                </div>
              )}
              
              <div className="flex justify-center">
                <div className="bg-white rounded-lg p-6 border-2 border-blue-100 shadow-md transition-all duration-300 hover:shadow-lg max-w-md w-full hover:border-blue-300">
                  <div className="relative">
                    {status.qrCode ? (
                      // Tampilkan QR code asli dari WhatsApp service
                      <>
                        <div className="flex justify-center">
                          <div className="relative">
                            <img 
                              src={`data:image/png;base64,${status.qrCode}`}
                              alt="WhatsApp QR Code" 
                              className="w-64 h-64 rounded-md shadow-md transition-all duration-300 hover:shadow-lg transform hover:scale-105"
                              onError={(e) => {
                                console.error('Error loading QR code image');
                                // Jika gagal memuat QR code asli, tampilkan QR code demo
                                const target = e.target as HTMLImageElement;
                                target.src = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=whatsapp-demo-qrcode";
                                // Tambahkan pesan error
                                const parent = target.parentElement?.parentElement;
                                if (parent) {
                                  const errorDiv = document.createElement('div');
                                  errorDiv.className = "mt-2 text-red-600 text-sm text-center bg-red-50 p-2 rounded-md";
                                  errorDiv.textContent = "Error loading QR code. Using demo QR code.";
                                  parent.appendChild(errorDiv);
                                }
                              }}
                            />
                          </div>
                        </div>
                        <div className="mt-4 text-center bg-blue-50 p-3 rounded-md border border-blue-100 shadow-sm overflow-hidden">
                          <p className="text-blue-700 font-medium">{t('whatsapp.scanQrCode')}</p>
                          <p className="text-blue-600 text-sm mt-1">{t('whatsapp.scanQrCode')}</p>
                        </div>
                      </>
                    ) : (
                      // Tampilkan QR code demo jika tidak ada QR code dari WhatsApp service
                      <>
                        <div className="flex justify-center">
                          <div className="relative">
                            <img 
                              src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=whatsapp-demo-qrcode"
                              alt="Demo WhatsApp QR Code" 
                              className="w-64 h-64 rounded-md opacity-50 shadow-md"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50 rounded-md">
                              <div className="text-center p-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-yellow-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <p className="text-yellow-700 font-medium">{t('whatsapp.qrCode')} {t('common.unknown')}</p>
                                <p className="text-gray-600 text-sm mt-1">{t('whatsapp.refreshQR')}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 text-center bg-yellow-50 p-3 rounded-md border border-yellow-100 shadow-sm overflow-hidden">
                          <p className="text-yellow-700 font-medium">{t('whatsapp.qrCode')} {t('common.unknown')}</p>
                          <p className="text-yellow-600 text-sm mt-1">{t('whatsapp.refreshQR')}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
