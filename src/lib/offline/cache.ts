const CACHE_PREFIX = 'wesd_cache_';
const CACHE_META_KEY = `${CACHE_PREFIX}_meta`;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheMeta {
  version: number;
  keys: string[];
}

const getMeta = (): CacheMeta => {
  try {
    const raw = localStorage.getItem(CACHE_META_KEY);
    return raw ? JSON.parse(raw) : { version: 1, keys: [] };
  } catch {
    return { version: 1, keys: [] };
  }
};

const saveMeta = (meta: CacheMeta) => {
  localStorage.setItem(CACHE_META_KEY, JSON.stringify(meta));
};

export const cacheGet = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > entry.ttl) {
      localStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
};

export const cacheSet = <T>(key: string, data: T, ttl = 5 * 60 * 1000) => {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttl };
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
    const meta = getMeta();
    if (!meta.keys.includes(key)) {
      meta.keys.push(key);
      saveMeta(meta);
    }
  } catch {
    // localStorage full — silently fail
  }
};

export const cacheInvalidate = (key: string) => {
  localStorage.removeItem(`${CACHE_PREFIX}${key}`);
  const meta = getMeta();
  meta.keys = meta.keys.filter((k) => k !== key);
  saveMeta(meta);
};

export const cacheClear = () => {
  const meta = getMeta();
  meta.keys.forEach((k) => localStorage.removeItem(`${CACHE_PREFIX}${k}`));
  localStorage.removeItem(CACHE_META_KEY);
};

export const cacheClearExpired = () => {
  const meta = getMeta();
  const validKeys: string[] = [];
  meta.keys.forEach((k) => {
    try {
      const raw = localStorage.getItem(`${CACHE_PREFIX}${k}`);
      if (!raw) return;
      const entry = JSON.parse(raw);
      if (Date.now() - entry.timestamp <= entry.ttl) {
        validKeys.push(k);
      } else {
        localStorage.removeItem(`${CACHE_PREFIX}${k}`);
      }
    } catch {
      localStorage.removeItem(`${CACHE_PREFIX}${k}`);
    }
  });
  meta.keys = validKeys;
  saveMeta(meta);
};

// Scoped helpers for specific entity types
const entityCache = <T>(entityType: string) => ({
  get: () => cacheGet<T[]>(entityType),
  set: (data: T[], ttl?: number) => cacheSet(entityType, data, ttl),
  invalidate: () => cacheInvalidate(entityType),
});

export const salonServicesCache = entityCache<import('@/lib/store').Service>('salon_services');
export const salonEmployeesCache = entityCache<import('@/lib/store').Employee>('salon_employees');
export const salonClientsCache = entityCache<import('@/lib/store').Client>('salon_clients');
export const salonAppointmentsCache = entityCache<import('@/lib/store').Appointment>('salon_appointments');
