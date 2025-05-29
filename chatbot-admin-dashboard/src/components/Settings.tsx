'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/context/LanguageContext';

interface ChatbotSettings {
  initialPrompt: string;
  maxTokens: number;
  temperature: number;
  modelName: string;
}

const defaultSettings: ChatbotSettings = {
  initialPrompt: 'Anda adalah asisten AI untuk RSH Satu Bumi yang membantu menjawab pertanyaan tentang program kesehatan dan detoksifikasi. Jawab dengan sopan, informatif, dan sesuai dengan nilai-nilai RSH Satu Bumi.',
  maxTokens: 500,
  temperature: 0.7,
  modelName: 'gpt-3.5-turbo'
};

const Settings = () => {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<ChatbotSettings>(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Fetch current settings from backend
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const response = await axios.get('http://localhost:5000/settings');
        if (response.data) {
          setSettings(response.data);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
        toast.error(t('settings.errorFetchingSettings'));
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Convert number inputs from string to number
    if (name === 'maxTokens' || name === 'temperature') {
      setSettings({
        ...settings,
        [name]: name === 'temperature' ? parseFloat(value) : parseInt(value)
      });
    } else {
      setSettings({
        ...settings,
        [name]: value
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      await axios.post('http://localhost:5000/settings', settings);
      toast.success(t('settings.settingsSaved'));
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(t('settings.errorSavingSettings'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 w-full">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">{t('settings.chatbotSettings')}</h2>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="initialPrompt" className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.initialPrompt')}
            </label>
            <textarea
              id="initialPrompt"
              name="initialPrompt"
              rows={6}
              value={settings.initialPrompt}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t('settings.enterInitialPrompt')}
            />
            <p className="mt-1 text-sm text-gray-500">
              {t('settings.initialPromptDescription')}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <label htmlFor="modelName" className="block text-sm font-medium text-gray-700 mb-2">
                {t('settings.modelName')}
              </label>
              <select
                id="modelName"
                name="modelName"
                value={settings.modelName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="maxTokens" className="block text-sm font-medium text-gray-700 mb-2">
                {t('settings.maxTokens')}
              </label>
              <input
                type="number"
                id="maxTokens"
                name="maxTokens"
                min="100"
                max="4000"
                value={settings.maxTokens}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-sm text-gray-500">
                {t('settings.maxTokensDescription')}
              </p>
            </div>
            
            <div>
              <label htmlFor="temperature" className="block text-sm font-medium text-gray-700 mb-2">
                {t('settings.temperature')}
              </label>
              <input
                type="number"
                id="temperature"
                name="temperature"
                min="0"
                max="2"
                step="0.1"
                value={settings.temperature}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-sm text-gray-500">
                {t('settings.temperatureDescription')}
              </p>
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-md shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
            >
              {saving ? t('settings.saving') : t('settings.saveSettings')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default Settings;
