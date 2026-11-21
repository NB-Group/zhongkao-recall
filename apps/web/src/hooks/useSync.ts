import { useCallback, useEffect, useState } from 'react';
import type { BackendClient } from '../lib/backend';
import { flushPendingEvents, getPendingEventCount } from '../lib/sync-queue';

export function useSync(backend: BackendClient) {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastError, setLastError] = useState<string>();

  const refreshCount = useCallback(async () => {
    setPendingCount(await getPendingEventCount());
  }, []);

  const flush = useCallback(async () => {
    try {
      const result = await flushPendingEvents(backend);
      await refreshCount();
      setLastError(result.failed > 0 ? '部分复习记录等待下次同步' : undefined);
      return result;
    } catch (error) {
      setLastError(error instanceof Error ? error.message : '同步失败');
      throw error;
    }
  }, [backend, refreshCount]);

  useEffect(() => {
    void refreshCount();
    if (navigator.onLine) void flush();
    const handleOnline = () => {
      setOnline(true);
      void flush();
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flush, refreshCount]);

  return { online, pendingCount, lastError, flush, refreshCount };
}
