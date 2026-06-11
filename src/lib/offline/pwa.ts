// PWA lifecycle helpers

export const isPWAInstalled = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as Record<string, unknown>).standalone === true
  );
};

export const getDisplayMode = (): 'standalone' | 'browser' | 'unknown' => {
  if (typeof window === 'undefined') return 'unknown';
  if (window.matchMedia('(display-mode: standalone)').matches) return 'standalone';
  if ((window.navigator as unknown as Record<string, unknown>).standalone) return 'standalone';
  return 'browser';
};

export const isMobileScreen = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
};

export const isTouchDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};
