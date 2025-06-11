'use client';

import React, { useState, useEffect } from 'react';
import { UserData } from '../types/analytics';
import { exportUsersToCSV, exportUsersToPDF } from '../utils/exportUtils';
import { useLanguage } from '../context/LanguageContext';

interface UserExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: { [phone: string]: UserData };
  uniqueComplaints: string[];
}

const UserExportModal: React.FC<UserExportModalProps> = ({
  isOpen,
  onClose,
  users,
  uniqueComplaints
}) => {
  const { t } = useLanguage();
  
  // Get unique provinces from users
  const [uniqueProvinces, setUniqueProvinces] = useState<string[]>([]);
  
  // Export filters
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [selectedComplaints, setSelectedComplaints] = useState<string[]>(['all']);
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [minAge, setMinAge] = useState<string>('');
  const [maxAge, setMaxAge] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv'>('pdf');
  
  // Extract unique provinces from users
  useEffect(() => {
    if (users) {
      const provinces = new Set<string>();
      
      Object.values(users).forEach(userData => {
        if (userData.details.location) {
          // Extract province from location
          // Assuming format like "City, Province" or just "Province"
          const locationParts = userData.details.location.split(',');
          const province = locationParts.length > 1 
            ? locationParts[1].trim() 
            : locationParts[0].trim();
          
          if (province) {
            provinces.add(province);
          }
        }
      });
      
      setUniqueProvinces(Array.from(provinces).sort());
    }
  }, [users]);
  
  // Handle complaint selection
  const handleComplaintChange = (complaint: string) => {
    if (complaint === 'all') {
      setSelectedComplaints(['all']);
    } else {
      const newSelection = selectedComplaints.includes(complaint)
        ? selectedComplaints.filter(c => c !== complaint)
        : [...selectedComplaints.filter(c => c !== 'all'), complaint];
      
      setSelectedComplaints(newSelection.length > 0 ? newSelection : ['all']);
    }
  };
  
  // State for loading indicator
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Handle export button click
  const handleExport = async () => {
    // Reset error state
    setExportError(null);
    
    // Prepare filters
    const filters = {
      gender: genderFilter,
      healthComplaints: selectedComplaints,
      location: locationFilter,
      ageRange: {
        min: minAge ? parseInt(minAge) : undefined,
        max: maxAge ? parseInt(maxAge) : undefined
      }
    };
    
    if (exportFormat === 'pdf') {
      try {
        // Show loading indicator
        setIsExporting(true);
        
        // Generate PDF using the async function
        await exportUsersToPDF(users, filters, t);
        
        // Hide loading indicator
        setIsExporting(false);
      } catch (error) {
        console.error('Error exporting PDF:', error);
        setExportError(t('users.exportError') || 'Error exporting PDF. Please try again.');
        setIsExporting(false);
      }
    } else {
      try {
        // Generate CSV and create download link
        const csvUrl = exportUsersToCSV(users, filters);
        
        // Create a temporary anchor element to trigger download
        const downloadLink = document.createElement('a');
        downloadLink.href = csvUrl;
        downloadLink.download = `user-data-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Release the object URL
        setTimeout(() => {
          URL.revokeObjectURL(csvUrl);
        }, 100);
      } catch (error) {
        console.error('Error exporting CSV:', error);
        setExportError(t('users.exportError') || 'Error exporting CSV. Please try again.');
      }
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">{t('users.exportTitle') || 'User Data Export'}</h2>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-6">
            {/* Export Format Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('users.exportFormat') || 'Export Format'}
              </label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio"
                    name="exportFormat"
                    value="pdf"
                    checked={exportFormat === 'pdf'}
                    onChange={() => setExportFormat('pdf')}
                  />
                  <span className="ml-2">{t('users.exportAsPDF') || 'Export as PDF'}</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio"
                    name="exportFormat"
                    value="csv"
                    checked={exportFormat === 'csv'}
                    onChange={() => setExportFormat('csv')}
                  />
                  <span className="ml-2">{t('users.exportAsCSV') || 'Export as CSV'}</span>
                </label>
              </div>
            </div>
            {/* Gender filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('users.filterByGender') || 'Filter by Gender'}
              </label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio"
                    name="gender"
                    value="all"
                    checked={genderFilter === 'all'}
                    onChange={() => setGenderFilter('all')}
                  />
                  <span className="ml-2">{t('users.allGenders') || 'All Genders'}</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio"
                    name="gender"
                    value="male"
                    checked={genderFilter === 'male'}
                    onChange={() => setGenderFilter('male')}
                  />
                  <span className="ml-2">{t('users.maleOnly') || 'Male Only'}</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio"
                    name="gender"
                    value="female"
                    checked={genderFilter === 'female'}
                    onChange={() => setGenderFilter('female')}
                  />
                  <span className="ml-2">{t('users.femaleOnly') || 'Female Only'}</span>
                </label>
              </div>
            </div>
            
            {/* Age range filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('users.filterByAge') || 'Filter by Age Range'}
              </label>
              <div className="flex space-x-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('users.minAge') || 'Min Age'}</label>
                  <input
                    type="number"
                    className="form-input w-20 px-2 py-1 border border-gray-300 rounded"
                    value={minAge}
                    onChange={(e) => setMinAge(e.target.value)}
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t('users.maxAge') || 'Max Age'}</label>
                  <input
                    type="number"
                    className="form-input w-20 px-2 py-1 border border-gray-300 rounded"
                    value={maxAge}
                    onChange={(e) => setMaxAge(e.target.value)}
                    min="0"
                  />
                </div>
              </div>
            </div>
            
            {/* Province filter */}
            {uniqueProvinces.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('users.filterByProvince') || 'Filter by Province'}
                </label>
                <select
                  className="form-select w-full px-3 py-2 border border-gray-300 rounded"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                >
                  <option value="all">{t('users.allProvinces') || 'All Provinces'}</option>
                  {uniqueProvinces.map(province => (
                    <option key={province} value={province}>{province}</option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Health complaints filter */}
            {uniqueComplaints.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('users.filterByComplaints') || 'Filter by Health Complaints'}
                </label>
                <div className="max-h-40 overflow-y-auto p-2 border border-gray-200 rounded">
                  <div className="mb-2">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        className="form-checkbox"
                        checked={selectedComplaints.includes('all')}
                        onChange={() => setSelectedComplaints(['all'])}
                      />
                      <span className="ml-2">{t('users.allComplaints') || 'All Complaints'}</span>
                    </label>
                  </div>
                  {uniqueComplaints.map(complaint => (
                    <div key={complaint} className="mb-1">
                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          className="form-checkbox"
                          checked={selectedComplaints.includes(complaint)}
                          onChange={() => handleComplaintChange(complaint)}
                          disabled={selectedComplaints.includes('all')}
                        />
                        <span className="ml-2">{complaint}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Error message */}
            {exportError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4" role="alert">
                <span className="block sm:inline">{exportError}</span>
              </div>
            )}
            
            {/* Export button */}
            <div className="flex justify-end pt-4">
              <button
                onClick={handleExport}
                disabled={isExporting}
                className={`px-4 py-2 ${isExporting ? 'bg-blue-300' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded flex items-center`}
              >
                {isExporting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('users.exporting') || 'Exporting...'}
                  </>
                ) : (
                  <>
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-5 w-5 mr-2" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" 
                      />
                    </svg>
                    {t('users.exportData') || 'Export Data'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserExportModal;
