import { useEffect } from 'react';
import { useStore } from '../store';
import toast from 'react-hot-toast';

export function useNetwork() {
  const isOffline = useStore((state) => state.isOffline);
  const setOfflineStatus = useStore((state) => state.setOfflineStatus);
  const processSyncQueue = useStore((state) => state.processSyncQueue);

  useEffect(() => {
    function handleOnline() {
      setOfflineStatus(false);
      toast.success('Back online! Syncing data...', { duration: 3000 });
      processSyncQueue();
    }

    function handleOffline() {
      setOfflineStatus(true);
      toast.error('You are offline. Changes will be saved locally.', { duration: 4000 });
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (navigator.onLine && isOffline) {
      handleOnline();
    } else if (!navigator.onLine && !isOffline) {
      handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOffline, setOfflineStatus, processSyncQueue]);

  return isOffline;
}
