const SYNC_QUEUE_KEY = 'wesd_sync_queue';

export interface SyncOperation {
  id: string;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  data: Record<string, unknown>;
  originalId?: string;
  timestamp: number;
  retries: number;
}

let onSyncStatusChange: ((count: number) => void) | null = null;

const getQueue = (): SyncOperation[] => {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveQueue = (queue: SyncOperation[]) => {
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  onSyncStatusChange?.(queue.length);
};

const generateId = () =>
  `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

export const enqueueSync = (
  type: SyncOperation['type'],
  table: string,
  data: Record<string, unknown>,
  originalId?: string,
) => {
  const queue = getQueue();
  queue.push({
    id: generateId(),
    type,
    table,
    data,
    originalId,
    timestamp: Date.now(),
    retries: 0,
  });
  saveQueue(queue);
};

export const getPendingCount = (): number => getQueue().length;

export const clearSynced = () => saveQueue([]);

export const removeSynced = (ids: string[]) => {
  const queue = getQueue().filter((op) => !ids.includes(op.id));
  saveQueue(queue);
};

export const markRetry = (id: string) => {
  const queue = getQueue().map((op) =>
    op.id === id ? { ...op, retries: op.retries + 1 } : op,
  );
  saveQueue(queue);
};

export const onQueueChange = (
  cb: (count: number) => void,
) => {
  onSyncStatusChange = cb;
  return () => {
    onSyncStatusChange = null;
  };
};
