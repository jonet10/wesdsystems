import { useState, useEffect } from "react";
import { useInstallPWA } from "@/hooks/useInstallPWA";
import { Download, X, Smartphone } from "lucide-react";

// Detect if app is already running as a PWA (installed)
function isRunningStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export function InstallPWAButton() {
  const { isInstallable, promptInstall } = useInstallPWA();
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(isRunningStandalone());
  }, []);

  // Don't show if: already installed as app, or user dismissed the banner
  if (isStandalone || dismissed) return null;

  return (
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
          onClick={isInstallable ? promptInstall : () => {
            // Fallback: guide user to browser's install option
            alert("Pour installer : appuyez sur le menu de votre navigateur puis « Ajouter à l'écran d'accueil »");
          }}
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
  );
}
