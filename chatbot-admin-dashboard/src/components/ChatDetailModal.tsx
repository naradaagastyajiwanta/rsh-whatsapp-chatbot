'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Chat } from '@/types/chat';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface ChatDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  chat: Chat;
}

const ChatDetailModal = ({ isOpen, onClose, chat }: ChatDetailModalProps) => {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white p-0 text-left align-middle shadow-xl transition-all">
                <div className="flex justify-between items-start p-6 bg-white">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center shadow-md ring-2 ring-blue-200 ring-opacity-50 transform transition-all duration-300 hover:scale-110">
                        <span className="font-bold text-white text-lg">
                          {chat.senderName?.charAt(0) || chat.sender.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="font-bold text-gray-800 text-lg">{chat.senderName || 'Unknown'}</div>
                        <div className="text-xs text-gray-500">{formatPhoneNumber(chat.sender)}</div>
                      </div>
                    </div>
                  </Dialog.Title>
                  <button
                    type="button"
                    className="rounded-full p-1 bg-gray-100 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-200 focus:outline-none"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div className="p-6 bg-gradient-to-b from-blue-50 to-white rounded-lg h-96 overflow-y-auto custom-scrollbar">
                  <div className="space-y-4">
                    {chat.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.isFromUser ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[75%] rounded-lg px-4 py-3 shadow-sm transition-all duration-200 hover:shadow-md ${
                            message.isFromUser
                              ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white'
                              : 'bg-white border border-gray-200 hover:border-blue-200'
                          }`}
                        >
                          <div className="text-sm">{message.content}</div>
                          <div
                            className={`text-xs mt-1 ${
                              message.isFromUser ? 'text-primary-100' : 'text-gray-400'
                            }`}
                          >
                            {formatMessageTime(message.timestamp)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-6 flex justify-between items-center bg-white">
                  <div>
                    <span className="text-xs text-gray-500">
                      Total pesan: {chat.messages.length}
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg shadow-sm transition-all duration-200 hover:shadow transform hover:-translate-y-1 flex items-center text-sm"
                      onClick={onClose}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Tutup
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg shadow-sm transition-all duration-200 hover:shadow transform hover:-translate-y-1 flex items-center text-sm"
                      onClick={() => {
                        // Export chat functionality could be added here
                        alert('Export functionality will be implemented in the future');
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Export Chat
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

// Helper function to format phone numbers from WhatsApp format
const formatPhoneNumber = (phoneNumber: string): string => {
  // Extract the phone number from the WhatsApp format (e.g., "6281234567890@s.whatsapp.net")
  const match = phoneNumber.match(/^(\d+)@/);
  if (!match) return phoneNumber;
  
  const number = match[1];
  // Format as +62 812-3456-7890
  if (number.startsWith('62')) {
    return `+${number.substring(0, 2)} ${number.substring(2, 5)}-${number.substring(5, 9)}-${number.substring(9)}`;
  }
  return number;
};

// Helper function to format message timestamps
const formatMessageTime = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return format(date, 'HH:mm', { locale: id });
  } catch (error) {
    console.error('Error formatting message time:', error);
    return '';
  }
};

export default ChatDetailModal;
