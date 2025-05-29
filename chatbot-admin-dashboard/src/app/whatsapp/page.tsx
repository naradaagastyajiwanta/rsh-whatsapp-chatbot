'use client';

import React from 'react';
import Sidebar from '@/components/Sidebar';
import WhatsAppStatus from '@/components/WhatsAppStatus';
import WhatsAppSender from '@/components/WhatsAppSender';
import { PhoneIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '@/context/LanguageContext';

export default function WhatsAppPage() {
  const { t } = useLanguage();
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold flex items-center">
            <PhoneIcon className="h-6 w-6 mr-2 text-blue-500" />
            {t('whatsapp.title')}
          </h1>
          <p className="text-gray-600">
            {t('whatsapp.description')}
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <WhatsAppStatus />
          </div>
          <div>
            <WhatsAppSender />
          </div>
        </div>
      </div>
    </div>
  );
}
