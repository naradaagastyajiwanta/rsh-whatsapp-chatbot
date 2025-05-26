'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  HomeIcon, 
  ChatBubbleLeftRightIcon, 
  ChartBarIcon, 
  UserGroupIcon, 
  Cog6ToothIcon,
  PhoneIcon
} from '@heroicons/react/24/outline';

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);

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
            text="Dashboard" 
            href="/" 
            collapsed={collapsed} 
            active={true}
          />
          <SidebarItem 
            icon={<ChatBubbleLeftRightIcon className="w-6 h-6" />} 
            text="Conversations" 
            href="/conversations" 
            collapsed={collapsed} 
          />
          <SidebarItem 
            icon={<PhoneIcon className="w-6 h-6" />} 
            text="WhatsApp" 
            href="/whatsapp" 
            collapsed={collapsed} 
          />
          <SidebarItem 
            icon={<UserGroupIcon className="w-6 h-6" />} 
            text="Users" 
            href="/users" 
            collapsed={collapsed} 
          />
          <SidebarItem 
            icon={<ChartBarIcon className="w-6 h-6" />} 
            text="Analytics" 
            href="/analytics" 
            collapsed={collapsed} 
          />
          <SidebarItem 
            icon={<Cog6ToothIcon className="w-6 h-6" />} 
            text="Settings" 
            href="/settings" 
            collapsed={collapsed} 
          />
        </ul>
      </nav>

      <div className="absolute bottom-0 w-full p-4">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'space-x-3'}`}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-md ring-2 ring-blue-300 ring-opacity-30">
            <span className="text-sm font-bold">A</span>
          </div>
          {!collapsed && (
            <div className="transition-all duration-300">
              <div className="text-sm font-medium">Admin User</div>
              <div className="text-xs text-blue-300">admin@rshsatubumi.com</div>
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
