import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type OnlineStatus = 'online' | 'offline' | 'checking';

interface OnlineStatusResult {
  status: OnlineStatus;
  isOnline: boolean;
  lastOnlineAt: number | null;
  checkNow: () => void;
}

const getInitialStatus = (): OnlineStatus => {
  if (typeof navigator === 'undefined') return 'online';
  return navigator.onLine ? 'checking' : 'offline';
};

export const useOnlineStatus = (): OnlineStatusResult => {
  const [status, setStatus] = useState<OnlineStatus>(getInitialStatus);
  const [lastOnlineAt, setLastOnlineAt] = useState<number | null>(() =>
    typeof localStorage !== 'undefined'
      ? Number(localStorage.getItem('wesd_last_online')) || null
      : null,
  );

  const verifySupabase = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).limit(1).abortSignal(controller.signal);
      clearTimeout(timeout);
      if (error && (error.code?.startsWith('5') || error.code === 'PGRST116')) {
        setStatus('offline');
        return false;
      }
      setStatus('online');
      const now = Date.now();
      setLastOnlineAt(now);
      localStorage.setItem('wesd_last_online', String(now));
      return true;
    } catch {
      setStatus('offline');
      return false;
    }
  }, []);

  const checkNow = useCallback(() => {
    setStatus('checking');
    verifySupabase();
  }, [verifySupabase]);

  useEffect(() => {
    const handleOnline = () => {
      setStatus('checking');
      verifySupabase();
    };
    const handleOffline = () => setStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (navigator.onLine) {
      verifySupabase();
    }

    // Periodic check every 30s
    const interval = setInterval(() => {
      if (navigator.onLine) verifySupabase();
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [verifySupabase]);

  return {
    status,
    isOnline: status === 'online',
    lastOnlineAt,
    checkNow,
  };
};
