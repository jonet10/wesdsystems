import { useState, useEffect } from "react";
import { useInstallPWA } from "@/hooks/useInstallPWA";
import { Download, X, Smartphone, Chrome, Monitor, Apple, MoreVertical, Share } from "lucide-react";

// Detect browser type
function detectBrowser(): "chrome" | "safari" | "firefox" | "edge" | "other" {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("edg/")) return "edge";
  if (ua.includes("chrome") && !ua.includes("edg")) return "chrome";
  if (ua.includes("safari") && !ua.includes("chrome")) return "safari";
  if (ua.includes("firefox")) return "firefox";
  return "other";
}

// Detect iOS
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

// Detect if app is already running as a PWA (installed)
function isRunningStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

function InstallGuideModal({ onClose }: { onClose: () => void }) {
  const browser = detectBrowser();
  const ios = isIOS();

  const steps = ios
    ? [
        { icon: "1", text: "Appuyez sur l'icône Partager", sub: "Le bouton carré avec une flèche vers le haut en bas de Safari" },
        { icon: "2", text: "Faites défiler et appuyez sur « Sur l'écran d'accueil »", sub: "Ou « Ajouter à l'écran d'accueil »" },
        { icon: "3", text: "Appuyez sur « Ajouter »", sub: "L'application sera ajoutée à votre écran d'accueil" },
      ]
    : browser === "firefox"
    ? [
        { icon: "1", text: "Firefox ne supporte pas l'installation PWA", sub: "Utilisez Chrome, Edge ou Safari pour installer l'application" },
      ]
    : [
        { icon: "1", text: "Cliquez sur l'icône ⋮ en haut à droite", sub: "Menu principal du navigateur (trois points)" },
        { icon: "2", text: "Cherchez « Installer Wesd Systems »", sub: "Ou « Installer l'application »" },
        { icon: "3", text: "Confirmez l'installation", sub: "L'app s'ouvrira comme une application native" },
      ];

  const browserLabel =
    ios ? "Safari (iOS)" :
    browser === "chrome" ? "Google Chrome" :
    browser === "edge" ? "Microsoft Edge" :
    browser === "safari" ? "Safari" :
    browser === "firefox" ? "Firefox" : "votre navigateur";

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-violet-900/40"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 shadow-lg shadow-violet-500/30">
            <Smartphone className="h-7 w-7 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Installer l'application</h3>
            <p className="text-sm text-slate-400">Sur {browserLabel}</p>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-6">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600/30 to-cyan-500/30 border border-violet-500/30 text-sm font-bold text-cyan-400">
                {step.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{step.text}</p>
                <p className="text-xs text-slate-400 mt-0.5">{step.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* iOS share icon illustration */}
        {ios && (
          <div className="rounded-xl border border-white/5 bg-white/5 p-3 mb-4 flex items-center gap-2">
            <Share className="h-5 w-5 text-blue-400 shrink-0" />
            <p className="text-xs text-slate-300">L'icône Partager ressemble à <strong className="text-white">↑</strong> dans la barre du bas de Safari</p>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 py-3 text-sm font-semibold text-white shadow-md hover:from-violet-500 hover:to-cyan-400 transition-all"
        >
          J'ai compris
        </button>
      </div>
    </div>
  );
}

export function InstallPWAButton() {
  const { isInstallable, promptInstall } = useInstallPWA();
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    setIsStandalone(isRunningStandalone());
  }, []);

  // Don't show if already installed as app, or user dismissed the banner
  if (isStandalone || dismissed) return null;

  const handleInstallClick = () => {
    if (isInstallable) {
      // Native browser prompt available (Chrome/Edge Android/Desktop)
      promptInstall();
    } else {
      // Show step-by-step visual guide (Safari iOS, Firefox, etc.)
      setShowGuide(true);
    }
  };

  return (
    <>
      {/* Floating install banner */}
      <div className="fixed bottom-24 left-4 right-4 z-40 mx-auto max-w-sm sm:left-auto sm:right-24 sm:bottom-6">
        <div className="flex items-center gap-3 rounded-2xl border border-violet-500/30 bg-slate-950/90 p-4 shadow-2xl shadow-violet-900/30 backdrop-blur-xl">
          {/* Icon */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 shadow-lg shadow-violet-500/30">
            <Smartphone className="h-6 w-6 text-white" />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Installer Wesd Systems</p>
            <p className="text-xs text-slate-400 mt-0.5">Accès rapide depuis votre écran</p>
          </div>

          {/* Install button */}
          <button
            onClick={handleInstallClick}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-3 py-2 text-xs font-semibold text-white shadow-md transition-all hover:scale-105 hover:shadow-violet-500/40 active:scale-95"
          >
            <Download className="h-3.5 w-3.5" />
            Installer
          </button>

          {/* Dismiss */}
          <button
            onClick={() => setDismissed(true)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Installation guide modal */}
      {showGuide && <InstallGuideModal onClose={() => setShowGuide(false)} />}
    </>
  );
}
