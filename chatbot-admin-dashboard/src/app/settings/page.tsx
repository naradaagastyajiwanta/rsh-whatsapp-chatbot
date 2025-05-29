'use client';

import React from 'react';
import Sidebar from '@/components/Sidebar';
import Settings from '@/components/Settings';
import { Toaster } from 'react-hot-toast';
import { useLanguage } from '@/context/LanguageContext';

export default function SettingsPage() {
  const { t } = useLanguage();
  return (
    <div className="flex h-screen bg-gray-100">
      <Toaster position="top-right" />
      <Sidebar />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">{t('settings.title')}</h1>
          <p className="text-gray-600">{t('settings.apiSettings')}</p>
        </div>
        
        <Settings />
      </div>
    </div>
  );
}
