'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  HomeIcon, 
  ChatBubbleLeftRightIcon, 
  ChartBarIcon, 
  UserGroupIcon, 
  Cog6ToothIcon,
  PhoneIcon,
  DocumentTextIcon,
  LanguageIcon
} from '@heroicons/react/24/outline';
import { useLanguage } from '../context/LanguageContext';

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { language, changeLanguage, t } = useLanguage();

  return (
    <div 
      className={`bg-gradient-to-b from-blue-800 to-blue-900 text-white transition-all duration-300 shadow-xl ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="p-4 flex items-center justify-between">
        {!collapsed && (
          <div className="font-bold text-xl flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mr-2 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="bg-gradient-to-r from-white to-blue-200 text-transparent bg-clip-text">RSH Admin</span>
          </div>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)} 
          className="p-1 rounded-md hover:bg-blue-700 transition-all duration-200 hover:shadow-lg hover:scale-110"
        >
          {collapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          )}
        </button>
      </div>

      <nav className="mt-6 px-2">
        <ul>
          <SidebarItem 
            icon={<HomeIcon className="w-6 h-6" />} 
            text={t('sidebar.dashboard')} 
            href="/" 
            collapsed={collapsed} 
            active={pathname === '/'}
          />
          <SidebarItem 
            icon={<ChatBubbleLeftRightIcon className="w-6 h-6" />} 
            text={t('sidebar.conversations')} 
            href="/conversations" 
            collapsed={collapsed} 
            active={pathname === '/conversations' || pathname.startsWith('/conversations/')}
          />
          <SidebarItem 
            icon={<PhoneIcon className="w-6 h-6" />} 
            text={t('sidebar.whatsapp')} 
            href="/whatsapp" 
            collapsed={collapsed} 
            active={pathname === '/whatsapp' || pathname.startsWith('/whatsapp/')}
          />
          <SidebarItem 
            icon={<UserGroupIcon className="w-6 h-6" />} 
            text={t('sidebar.users')} 
            href="/users" 
            collapsed={collapsed} 
            active={pathname === '/users' || pathname.startsWith('/users/')}
          />
          <SidebarItem 
            icon={<ChartBarIcon className="w-6 h-6" />} 
            text={t('sidebar.analytics')} 
            href="/analytics" 
            collapsed={collapsed} 
            active={pathname === '/analytics' || pathname.startsWith('/analytics/')}
          />
          <SidebarItem 
            icon={<DocumentTextIcon className="w-6 h-6" />} 
            text={t('sidebar.documents')} 
            href="/documents" 
            collapsed={collapsed} 
            active={pathname === '/documents' || pathname.startsWith('/documents/')}
          />
          <SidebarItem 
            icon={<Cog6ToothIcon className="w-6 h-6" />} 
            text={t('sidebar.settings')} 
            href="/settings" 
            collapsed={collapsed} 
            active={pathname === '/settings' || pathname.startsWith('/settings/')}
          />
          
          {/* Tombol pengalih bahasa */}
          <li className="mt-8">
            <div className={`flex items-center px-4 py-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-blue-700 ${collapsed ? 'justify-center' : ''}`}>
              <LanguageIcon className="w-6 h-6 text-blue-200" />
              {!collapsed && (
                <div className="ml-3 flex flex-col">
                  <span className="text-sm font-medium text-white">{t('common.language')}</span>
                  <div className="flex space-x-2 mt-1">
                    <button 
                      onClick={() => changeLanguage('id')} 
                      className={`text-xs px-2 py-1 rounded ${language === 'id' ? 'bg-blue-500 text-white' : 'bg-blue-800 text-blue-300'}`}
                    >
                      ID
                    </button>
                    <button 
                      onClick={() => changeLanguage('en')} 
                      className={`text-xs px-2 py-1 rounded ${language === 'en' ? 'bg-blue-500 text-white' : 'bg-blue-800 text-blue-300'}`}
                    >
                      EN
                    </button>
                  </div>
                </div>
              )}
              {collapsed && (
                <div className="absolute left-16 bg-blue-800 text-white p-2 rounded shadow-lg z-10 hidden group-hover:block">
                  <div className="flex flex-col space-y-2">
                    <button 
                      onClick={() => changeLanguage('id')} 
                      className={`text-xs px-2 py-1 rounded ${language === 'id' ? 'bg-blue-500 text-white' : 'bg-blue-700 text-blue-300'}`}
                    >
                      ID
                    </button>
                    <button 
                      onClick={() => changeLanguage('en')} 
                      className={`text-xs px-2 py-1 rounded ${language === 'en' ? 'bg-blue-500 text-white' : 'bg-blue-700 text-blue-300'}`}
                    >
                      EN
                    </button>
                  </div>
                </div>
              )}
            </div>
          </li>
        </ul>
      </nav>

      <div className="absolute bottom-0 w-full p-4">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'space-x-3'}`}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-md ring-2 ring-blue-300 ring-opacity-30">
            <span className="text-sm font-bold">A</span>
          </div>
          {!collapsed && (
            <div className="transition-all duration-300">
              <div className="text-sm font-medium">{t('sidebar.adminUser')}</div>
              <div className="text-xs text-blue-300">{t('common.adminEmail')}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface SidebarItemProps {
  icon: React.ReactNode;
  text: string;
  href: string;
  collapsed: boolean;
  active?: boolean;
}

const SidebarItem = ({ icon, text, href, collapsed, active = false }: SidebarItemProps) => {
  return (
    <li className="mb-2">
      <Link 
        href={href}
        className={`flex items-center py-3 px-4 rounded-lg transition-all duration-200 ${
          collapsed ? 'justify-center' : 'space-x-3'
        } ${
          active 
            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md' 
            : 'text-blue-100 hover:bg-blue-700/70 hover:text-white hover:shadow-md'
        }`}
      >
        <span className={`transition-all duration-200 ${active ? 'text-white' : 'text-blue-300'} ${!active && 'group-hover:text-white'}`}>{icon}</span>
        {!collapsed && <span className="font-medium">{text}</span>}
      </Link>
    </li>
  );
};

export default Sidebar;
