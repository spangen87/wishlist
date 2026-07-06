'use client';
import { useEffect, useState } from 'react';

// Chrome/Edge on Android fire this non-standard event when the app is
// installable; we stash it and trigger the native prompt from our banner.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'onskestjarnan-install-dismissed';
const SNOOZE_DAYS = 14;

function isSnoozed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    if (raw === 'installed') return true;
    const dismissedAt = Number(raw);
    return Date.now() - dismissedAt < SNOOZE_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari exposes standalone as a non-standard navigator property
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as Mac, but Macs don't have multi-touch
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes('Mac') && navigator.maxTouchPoints > 1)
  );
}

function isMobile(): boolean {
  return /Android|iPad|iPhone|iPod/.test(navigator.userAgent) || isIOS();
}

export function InstallPrompt() {
  const [mode, setMode] = useState<'hidden' | 'native' | 'ios'>('hidden');
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || isSnoozed() || !isMobile()) return;

    if (isIOS()) {
      // No install API on iOS — show "Lägg till på hemskärmen" instructions,
      // slightly delayed so it doesn't compete with the page loading in.
      const timer = setTimeout(() => setMode('ios'), 2500);
      return () => clearTimeout(timer);
    }

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setMode('native');
    }
    function handleInstalled() {
      try { localStorage.setItem(DISMISS_KEY, 'installed'); } catch { /* ignore */ }
      setMode('hidden');
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setMode('hidden');
  }

  async function handleInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') {
      try { localStorage.setItem(DISMISS_KEY, 'installed'); } catch { /* ignore */ }
    }
    setMode('hidden');
    setInstallEvent(null);
  }

  if (mode === 'hidden') return null;

  return (
    <div
      role="dialog"
      aria-label="Installera Önskestjärnan"
      className="fixed inset-x-0 z-50 px-4"
      style={{ bottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      <div
        className="mx-auto w-full max-w-md rounded-2xl p-4 flex flex-col gap-3"
        style={{
          background: '#fff',
          color: 'var(--color-ink-light)',
          boxShadow: '0 8px 32px rgba(28, 27, 46, 0.25)',
          border: '1px solid var(--color-border-light)',
        }}
      >
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt=""
            width={44}
            height={44}
            className="rounded-xl shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold text-[15px] leading-tight">
              Lägg till Önskestjärnan på hemskärmen
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-muted-light)' }}>
              Snabbare att öppna — som en riktig app, med egen ikon.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Stäng"
            className="shrink-0 flex items-center justify-center min-h-[36px] min-w-[36px] rounded-full text-[16px] leading-none"
            style={{ color: 'var(--color-muted-light)', background: 'var(--color-bg-light)' }}
          >
            ✕
          </button>
        </div>

        {mode === 'native' ? (
          <button type="button" onClick={handleInstall} className="light-cta w-full">
            Installera appen
          </button>
        ) : (
          <p
            className="text-[13px] rounded-xl px-3 py-2.5"
            style={{ background: 'var(--color-accent-soft)', color: 'var(--color-ink-light)' }}
          >
            Tryck på <strong>Dela</strong>-knappen{' '}
            <span aria-hidden="true" style={{ display: 'inline-block', transform: 'translateY(-1px)' }}>
              {/* iOS share glyph */}
              <svg width="13" height="16" viewBox="0 0 13 16" fill="none" aria-hidden="true">
                <path d="M6.5 1v9M3.5 3.5 6.5 1l3 2.5" stroke="var(--color-accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 6.5H1v8.5h11V6.5h-1" stroke="var(--color-accent)" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </span>{' '}
            i webbläsaren och välj <strong>”Lägg till på hemskärmen”</strong>.
          </p>
        )}
      </div>
    </div>
  );
}
