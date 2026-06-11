import { supabase } from '@/lib/supabase';
import { cacheGet, cacheSet, cacheInvalidate } from './cache';
import { enqueueSync, getPendingCount } from './SyncManager';

type OfflineMode = 'auto' | 'force_online' | 'force_offline';

let currentMode: OfflineMode = 'auto';
let isOnline = navigator.onLine;

export const setOfflineMode = (mode: OfflineMode) => {
  currentMode = mode;
};

export const setOnlineStatus = (online: boolean) => {
  isOnline = online;
};

const shouldUseCache = () => {
  if (currentMode === 'force_offline') return true;
  if (currentMode === 'force_online') return false;
  return !isOnline;
};

export const offlineSelect = async <T>(
  table: string,
  cacheKey: string,
  query?: (q: typeof supabase) => ReturnType<typeof supabase.from>,
  ttl = 5 * 60 * 1000,
): Promise<{ data: T[] | null; fromCache: boolean; error: unknown }> => {
  if (shouldUseCache()) {
    const cached = cacheGet<T[]>(cacheKey);
    if (cached) return { data: cached, fromCache: true, error: null };
    return { data: null, fromCache: true, error: 'Offline: no cached data' };
  }

  try {
    const builder = query ? query(supabase) : supabase.from(table).select('*');
    const { data, error } = await builder;
    if (error) throw error;
    if (data) cacheSet(cacheKey, data, ttl);
    return { data: data as T[] | null, fromCache: false, error: null };
  } catch (err) {
    // Fallback to cache on error
    const cached = cacheGet<T[]>(cacheKey);
    if (cached) return { data: cached, fromCache: true, error: null };
    return { data: null, fromCache: false, error: err };
  }
};

export const offlineMutation = async <T>(
  type: 'INSERT' | 'UPDATE' | 'DELETE',
  table: string,
  supabaseCall: () => Promise<{ data: T | null; error: unknown }>,
  cacheKeys?: string[],
): Promise<{ data: T | null; fromQueue: boolean; error: unknown }> => {
  if (shouldUseCache()) {
    enqueueSync(type, table, {});
    cacheKeys?.forEach(cacheInvalidate);
    return { data: null, fromQueue: true, error: null };
  }

  try {
    const { data, error } = await supabaseCall();
    if (error) throw error;
    cacheKeys?.forEach(cacheInvalidate);
    return { data, fromQueue: false, error: null };
  } catch (err) {
    enqueueSync(type, table, {});
    cacheKeys?.forEach(cacheInvalidate);
    return { data: null, fromQueue: true, error: err };
  }
};
