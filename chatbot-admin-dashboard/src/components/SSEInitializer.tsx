'use client';

import { useEffect } from 'react';
import sseService from '@/services/sse';

/**
 * Component to initialize SSE connection when the app loads
 * This is a client component that should be imported in a layout or page
 */
export default function SSEInitializer() {
  useEffect(() => {
    console.log('🔄 Initializing SSE connection from SSEInitializer');
    
    // Connect to SSE
    sseService.connect();
    
    // Clean up on unmount
    return () => {
      sseService.disconnect();
    };
  }, []);
  
  // This component doesn't render anything
  return null;
}
