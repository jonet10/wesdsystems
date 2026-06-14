import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Global reference so the event is never lost
let _deferredPrompt: BeforeInstallPromptEvent | null = null;
const _listeners: Array<(e: BeforeInstallPromptEvent | null) => void> = [];

// Listen as early as possible (module-level, outside React)
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    _deferredPrompt = e as BeforeInstallPromptEvent;
    _listeners.forEach((fn) => fn(_deferredPrompt));
  });

  window.addEventListener("appinstalled", () => {
    _deferredPrompt = null;
    _listeners.forEach((fn) => fn(null));
  });
}

export function useInstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(_deferredPrompt);
  const [isInstallable, setIsInstallable] = useState(!!_deferredPrompt);

  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent | null) => {
      setDeferredPrompt(e);
      setIsInstallable(!!e);
    };
    _listeners.push(handler);
    return () => {
      const idx = _listeners.indexOf(handler);
      if (idx > -1) _listeners.splice(idx, 1);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      _deferredPrompt = null;
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
    return outcome === "accepted";
  }, [deferredPrompt]);

  return { isInstallable, promptInstall };
}
