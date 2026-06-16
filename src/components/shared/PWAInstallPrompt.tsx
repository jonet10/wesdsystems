import { useState, useEffect, useCallback } from 'react';
import { Download, X, Smartphone, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isRunningStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function IOSGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 shadow-lg">
            <Smartphone className="h-7 w-7 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Installer sur iPhone/iPad</h3>
            <p className="text-sm text-slate-400">3 étapes simples dans Safari</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {[
            { n: '1', title: 'Appuyez sur l\'icône Partager', desc: 'Le bouton ↑ en bas de Safari', icon: <Share className="h-4 w-4 text-blue-400" /> },
            { n: '2', title: 'Sur l\'écran d\'accueil', desc: 'Faites défiler et appuyez sur « Sur l\'écran d\'accueil »', icon: null },
            { n: '3', title: 'Appuyez sur « Ajouter »', desc: 'L\'icône Wesd apparaîtra sur votre écran', icon: null },
          ].map((step) => (
            <div key={step.n} className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600/30 to-cyan-500/30 border border-violet-500/30 text-sm font-bold text-cyan-400">
                {step.n}
              </div>
              <div>
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  {step.title} {step.icon}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 py-3 text-sm font-semibold text-white shadow-md hover:opacity-90 transition-opacity"
        >
          J'ai compris
        </button>
      </div>
    </div>
  );
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Don't show if already installed
    if (isRunningStandalone()) return;

    // iOS Safari: always show the banner (no beforeinstallprompt event on iOS)
    if (isIOS()) {
      setIsVisible(true);
      return;
    }

    // Android/Desktop: wait for browser's install event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Hide if app gets installed
    const onInstalled = () => {
      setIsVisible(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (isIOS()) {
      // Show step-by-step guide for iOS
      setShowIOSGuide(true);
      return;
    }
    if (!deferredPrompt) {
      // Pour forcer l'affichage si le navigateur ne le supporte plus
      alert("Votre navigateur a bloqué l'installation automatique. Vous pouvez l'installer depuis les paramètres de votre navigateur (Ajouter à l'écran d'accueil).");
      return;
    }
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsVisible(false);
        setDeferredPrompt(null);
      }
    } catch (err) {
      console.error("Erreur d'installation PWA:", err);
      // Le prompt ne peut être utilisé qu'une seule fois
      setIsVisible(false);
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  if (!isVisible) return null;

  return (
    <>
      <div className="fixed top-24 left-0 right-0 z-[99998] mx-auto max-w-sm px-4 animate-in slide-in-from-top-10 fade-in duration-500">
        <div className="flex flex-col gap-3 rounded-2xl border border-violet-500/30 bg-slate-950/95 p-4 shadow-2xl shadow-violet-900/30 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 shadow-lg shadow-violet-500/30">
              <Smartphone className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-sm font-bold text-white leading-tight">Installer Wesd Systems</p>
              <p className="text-xs text-slate-400 mt-0.5">Accès rapide depuis votre écran d'accueil</p>
            </div>
            <button
              onClick={() => setIsVisible(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <button
            onClick={handleInstall}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <Download className="h-4 w-4" />
            Installer maintenant
          </button>
        </div>
      </div>

      {showIOSGuide && <IOSGuideModal onClose={() => setShowIOSGuide(false)} />}
    </>
  );
}
