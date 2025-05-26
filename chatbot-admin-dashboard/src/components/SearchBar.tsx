'use client';

import { useState } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

const SearchBar = ({ onSearch }: SearchBarProps) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <div className="w-full animate-fadeIn">
      <form onSubmit={handleSubmit} className="relative bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <MagnifyingGlassIcon className="w-5 h-5 text-blue-500" />
          </div>
          <input
            type="search"
            className="input pl-10 pr-10 focus:ring-blue-500 focus:border-blue-500 shadow-sm hover:shadow transition-all duration-200"
            placeholder="Cari berdasarkan nomor WhatsApp atau isi pesan..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-3 transition-all duration-200"
              onClick={handleClear}
            >
              <XMarkIcon className="w-5 h-5 text-gray-400 hover:text-red-500 transition-colors duration-200" />
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="submit"
            className="btn btn-primary text-sm px-4 py-2 flex items-center"
          >
            <MagnifyingGlassIcon className="w-4 h-4 mr-2" />
            Cari
          </button>
          <button
            type="button"
            className="btn btn-secondary text-sm px-4 py-2 flex items-center"
            onClick={handleClear}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset
          </button>
          <div className="hidden sm:block flex-grow"></div>
          <div className="w-full sm:w-auto mt-2 sm:mt-0 flex flex-wrap sm:flex-nowrap gap-2">
            <div className="relative w-full sm:w-auto">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <select className="input text-sm py-2 pl-10 pr-8 appearance-none bg-white" defaultValue="">
                <option value="">Filter Tanggal</option>
                <option value="today">Hari Ini</option>
                <option value="yesterday">Kemarin</option>
                <option value="week">Minggu Ini</option>
                <option value="month">Bulan Ini</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <div className="relative w-full sm:w-auto">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
              </div>
              <select className="input text-sm py-2 pl-10 pr-8 appearance-none bg-white" defaultValue="">
                <option value="">Urutkan</option>
                <option value="newest">Terbaru</option>
                <option value="oldest">Terlama</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default SearchBar;
