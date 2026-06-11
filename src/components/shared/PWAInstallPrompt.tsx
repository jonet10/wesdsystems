import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsVisible(false);
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
  }, []);

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 60,
        left: 16,
        right: 16,
        zIndex: 99998,
        padding: '12px 16px',
        background: '#1E3A5F',
        borderRadius: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ color: '#FFF', fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
          Installer Wesd Systems
        </div>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
          Ajoutez sur votre écran d'accueil pour un accès rapide
        </div>
      </div>
      <button
        onClick={handleInstall}
        style={{
          padding: '8px 16px',
          background: '#4ADE80',
          border: 'none',
          borderRadius: 8,
          color: '#1E3A5F',
          fontWeight: 700,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        Installer
      </button>
      <button
        onClick={handleDismiss}
        style={{
          padding: '8px',
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.5)',
          fontSize: 18,
          cursor: 'pointer',
        }}
      >
        ✕
      </button>
    </div>
  );
}
