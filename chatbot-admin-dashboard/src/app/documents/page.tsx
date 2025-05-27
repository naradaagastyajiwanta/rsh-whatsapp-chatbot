"use client";

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { Toaster } from 'react-hot-toast';
import { DocumentArrowUpIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import toast from 'react-hot-toast';

interface IndexStatus {
  status: string;
  index_name: string;
  dimension: number;
  metric: string;
  pod_type: string;
  vector_count: number;
  namespaces: string[];
}

interface UploadResponse {
  success: boolean;
  message: string;
  file_name?: string;
  file_size?: number;
  chunks?: number;
}

export default function DocumentsPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null);
  const [indexStatus, setIndexStatus] = useState<IndexStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setFiles(Array.from(event.target.files));
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      setFiles(Array.from(event.dataTransfer.files));
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const fetchIndexStatus = async () => {
    setLoadingStatus(true);
    setError(null);
    try {
      const response = await axios.get('http://localhost:5000/document/status');
      setIndexStatus(response.data);
    } catch (err) {
      console.error('Error fetching index status:', err);
      setError('Failed to fetch index status. Please try again later.');
      toast.error('Failed to fetch index status');
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    setError(null);
    setUploadResponse(null);
    
    const formData = new FormData();
    // Hanya menggunakan file pertama karena backend hanya mendukung satu file
    if (files.length > 0) {
      formData.append('file', files[0]);
    }
    
    try {
      const response = await axios.post('http://localhost:5000/document/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setUploadResponse(response.data);
      setFiles([]);
      // Refresh index status after successful upload
      fetchIndexStatus();
      toast.success('File uploaded successfully!');
    } catch (err: any) {
      console.error('Error uploading files:', err);
      setError(err.response?.data?.message || 'Failed to upload files. Please try again.');
      toast.error('Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    fetchIndexStatus();
  }, []);

  return (
    <div className="flex h-screen bg-gray-100">
      <Toaster position="top-right" />
      <Sidebar />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Document Management</h1>
          <p className="text-gray-600">Upload documents to be indexed and used by the chatbot</p>
        </div>
        
        <div className="grid grid-cols-1 gap-6">
          {/* Upload Area */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div 
              className="p-8 border-2 border-dashed border-blue-300 rounded-lg text-center cursor-pointer hover:border-blue-500 transition-all"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <input
                className="hidden"
                accept=".txt,.pdf,.docx,.doc"
                id="file-upload"
                type="file"
                onChange={handleFileChange}
                multiple
              />
              
              <div className="flex flex-col items-center">
                <DocumentArrowUpIcon className="w-16 h-16 text-blue-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Drag and drop files here</h3>
                <p className="text-gray-500 mb-2">or</p>
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors inline-block">
                    Browse Files
                  </span>
                </label>
                <p className="text-sm text-gray-500 mt-4">Supported formats: .txt, .pdf, .docx, .doc</p>
                
                {files.length > 0 && (
                  <div className="mt-4">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      {files.length} file{files.length > 1 ? 's' : ''} selected
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 flex justify-center">
              <button 
                className={`px-6 py-2 rounded-md flex items-center space-x-2 ${uploading || files.length === 0 ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white transition-colors`}
                onClick={handleUpload} 
                disabled={files.length === 0 || uploading}
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <span>Upload and Index</span>
                  </>
                )}
              </button>
            </div>
            
            {error && (
              <div className="mx-4 mb-4 p-4 bg-red-100 text-red-700 rounded-md">
                {error}
              </div>
            )}
            
            {uploadResponse && uploadResponse.success && (
              <div className="mx-4 mb-4 p-4 bg-green-100 text-green-700 rounded-md">
                <p className="font-semibold">File uploaded successfully!</p>
                <p className="text-sm">File Name: {uploadResponse.file_name}</p>
                <p className="text-sm">File Size: {uploadResponse.file_size} bytes</p>
                <p className="text-sm">Chunks Created: {uploadResponse.chunks}</p>
              </div>
            )}
          </div>
          
          {/* Pinecone Status */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Pinecone Index Status</h2>
              <div className="border-t border-gray-200 pt-4">
                
                {loadingStatus ? (
                  <div className="flex justify-center my-8">
                    <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                ) : indexStatus ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="font-medium">Status</span>
                      <span className={`px-3 py-1 rounded-full text-sm ${indexStatus.status === 'Ready' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {indexStatus.status}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="font-medium">Index Name</span>
                      <span className="text-gray-600">{indexStatus.index_name}</span>
                    </div>
                    
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="font-medium">Dimension</span>
                      <span className="text-gray-600">{indexStatus.dimension}</span>
                    </div>
                    
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="font-medium">Metric</span>
                      <span className="text-gray-600">{indexStatus.metric}</span>
                    </div>
                    
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="font-medium">Pod Type</span>
                      <span className="text-gray-600">{indexStatus.pod_type}</span>
                    </div>
                    
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="font-medium">Vector Count</span>
                      <span className="text-gray-600">{indexStatus.vector_count}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No index information available.</p>
                )}
                
                <div className="flex justify-end mt-6">
                  <button 
                    className="flex items-center space-x-2 px-4 py-2 border border-blue-500 text-blue-500 rounded-md hover:bg-blue-50 transition-colors"
                    onClick={fetchIndexStatus} 
                    disabled={loadingStatus}
                  >
                    {loadingStatus ? (
                      <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <ArrowPathIcon className="h-5 w-5" />
                    )}
                    <span>Refresh Status</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
