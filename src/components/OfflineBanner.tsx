'use client';

import { useState, useEffect } from 'react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    setIsOffline(!navigator.onLine);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`sticky top-0 z-50 flex items-center px-4 overflow-hidden transition-all duration-300 text-sm text-[#171717] ${
        isOffline ? 'opacity-100 h-11' : 'opacity-0 h-0'
      }`}
      style={{ background: '#FFF0E8', borderBottom: '1px solid #E5D5CC' }}
    >
      Du är offline — data kan vara föråldrad
    </div>
  );
}
