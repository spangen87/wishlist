'use client';

import { useState, useEffect } from 'react';

export function UpdateToast() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then((reg) => {
      // Already waiting on mount
      if (reg.waiting) {
        setRegistration(reg);
        setShowUpdate(true);
      }
      // Detect new SW installing and transitioning to 'installed'
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            setRegistration(reg);
            setShowUpdate(true);
          }
        });
      });
    });
  }, []);

  const handleUpdate = () => {
    if (!registration?.waiting) return;
    setUpdating(true);
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  };

  if (!showUpdate) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-md"
      style={{ background: '#FFF0E8', border: '1px solid #E5D5CC' }}
    >
      <span className="text-sm text-[#171717]">Ny version tillgänglig</span>
      <button
        onClick={handleUpdate}
        disabled={updating}
        className={`rounded-xl px-4 py-2 text-sm font-semibold text-white min-h-[44px] transition-opacity ${
          updating ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        style={{ background: '#F9A87A' }}
      >
        Uppdatera nu
      </button>
    </div>
  );
}
