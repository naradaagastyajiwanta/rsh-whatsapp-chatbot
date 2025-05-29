'use client';

import { useEffect, useState } from 'react';
import { fetchChatStats } from '@/services/api';
import { ChatStats } from '@/types/chat';
import { 
  ChatBubbleLeftRightIcon, 
  UserGroupIcon, 
  ClockIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { useLanguage } from '@/context/LanguageContext';

const StatsCards = () => {
  const [stats, setStats] = useState<ChatStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { t, language } = useLanguage();

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        const data = await fetchChatStats();
        setStats(data);
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="bg-white rounded-lg p-5 shadow-md animate-pulse">
            <div className="flex items-start">
              <div className={`bg-gray-200 text-white p-3 rounded-lg mr-4 w-12 h-12`}></div>
              <div className="w-full">
                <div className="h-4 bg-gray-200 rounded mb-2 w-1/2"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard 
        title={t('dashboard.questionsToday')} 
        value={stats.totalChatsToday.toString()} 
        icon={<ChatBubbleLeftRightIcon className="w-8 h-8 transition-transform group-hover:scale-110 duration-300" />}
        color="bg-blue-500"
      />
      <StatCard 
        title={t('dashboard.questionsThisWeek')} 
        value={stats.totalChatsThisWeek.toString()} 
        icon={<CalendarIcon className="w-8 h-8 transition-transform group-hover:scale-110 duration-300" />}
        color="bg-green-500"
      />
      <StatCard 
        title={t('dashboard.activeUsers')} 
        value={stats.activeUsers.toString()} 
        icon={<UserGroupIcon className="w-8 h-8 transition-transform group-hover:scale-110 duration-300" />}
        color="bg-purple-500"
      />
      <StatCard 
        title={t('dashboard.averageResponseTime')} 
        value={`${stats.averageResponseTime} ${language === 'en' ? 'seconds' : 'detik'}`} 
        icon={<ClockIcon className="w-8 h-8 transition-transform group-hover:scale-110 duration-300" />}
        color="bg-orange-500"
      />
      {stats.totalMessages !== undefined && (
        <StatCard 
          title={t('dashboard.totalMessages')} 
          value={stats.totalMessages.toString()} 
          icon={<ChatBubbleLeftRightIcon className="w-8 h-8 transition-transform group-hover:scale-110 duration-300" />}
          color="bg-indigo-500"
        />
      )}
      {stats.uniqueUsers !== undefined && (
        <StatCard 
          title={t('dashboard.totalUsers')} 
          value={stats.uniqueUsers.toString()} 
          icon={<UserGroupIcon className="w-8 h-8 transition-transform group-hover:scale-110 duration-300" />}
          color="bg-pink-500"
        />
      )}
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

const StatCard = ({ title, value, icon, color }: StatCardProps) => {
  const gradients: Record<string, string> = {
    'bg-blue-500': 'from-blue-500 to-blue-600',
    'bg-green-500': 'from-green-500 to-green-600',
    'bg-purple-500': 'from-purple-500 to-purple-600',
    'bg-orange-500': 'from-orange-500 to-orange-600',
  };

  const gradient = gradients[color] || 'from-blue-500 to-blue-600';

  return (
    <div className="bg-white rounded-lg p-5 shadow-md transition-all duration-300 hover:shadow-lg hover:translate-y-[-2px]">
      <div className="flex items-start">
        <div className={`bg-gradient-to-br ${gradient} text-white p-3 rounded-lg mr-4 shadow-md`}>
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500">{title}</h3>
          <p className="text-2xl font-bold text-gray-800">{value}</p>

        </div>
      </div>
    </div>
  );
};

export default StatsCards;
